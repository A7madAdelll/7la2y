// Test harness: a fresh Postgres database per test file, with the Supabase shim and all migrations.
// Requires DATABASE_URL (any database on the server; used only to create/drop test databases).
import { readFileSync, readdirSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { randomBytes } from "node:crypto";
import pg from "pg";

const ROOT = pathJoin(import.meta.dirname, "..");
const ADMIN_URL = process.env.DATABASE_URL;

// CI sets REQUIRE_DB_TESTS=1 so a missing database fails loudly instead of silently skipping.
if (!ADMIN_URL && process.env.REQUIRE_DB_TESTS) {
  throw new Error("DATABASE_URL is required when REQUIRE_DB_TESTS is set");
}
export const hasDb = Boolean(ADMIN_URL);

export type Who =
  | { role: "anon" }
  | { role: "authenticated"; uid: string; email?: string }
  | { role: "service_role" } // our Next.js server
  | { role: "admin" }; // superuser, test setup only
export const anon: Who = { role: "anon" };
export const server: Who = { role: "service_role" };
export const user = (uid: string, email?: string): Who => ({ role: "authenticated", uid, email });

export class TestDb {
  private constructor(
    readonly name: string,
    readonly pool: pg.Pool,
  ) {}

  static async create(): Promise<TestDb> {
    const name = `t_${randomBytes(6).toString("hex")}`;
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`create database ${name}`);
    await admin.end();

    const url = new URL(ADMIN_URL!);
    url.pathname = `/${name}`;
    const pool = new pg.Pool({ connectionString: url.toString(), max: 60 });
    pool.on("error", () => {}); // idle clients are killed when the test database is dropped
    const files = [
      pathJoin(ROOT, "tests", "supabase-shim.sql"),
      ...readdirSync(pathJoin(ROOT, "migrations"))
        .filter((f) => f.endsWith(".sql"))
        .sort()
        .map((f) => pathJoin(ROOT, "migrations", f)),
    ];
    for (const f of files) await pool.query(readFileSync(f, "utf8"));
    return new TestDb(name, pool);
  }

  async drop() {
    await this.pool.end();
    const admin = new pg.Client({ connectionString: ADMIN_URL });
    await admin.connect();
    await admin.query(`drop database if exists ${this.name} with (force)`);
    await admin.end();
  }

  /** Run fn in one transaction as an API role, the way Supabase/PostgREST does. */
  async as<T>(who: Who, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
    const c = await this.pool.connect();
    try {
      await c.query("begin");
      if (who.role !== "admin") {
        await c.query(`set local role ${who.role}`);
        await c.query("select set_config('request.jwt.claim.sub', $1, true)", [
          who.role === "authenticated" ? who.uid : "",
        ]);
        await c.query("select set_config('request.jwt.claim.email', $1, true)", [
          who.role === "authenticated" ? (who.email ?? "") : "",
        ]);
      }
      const result = await fn(c);
      await c.query("commit");
      return result;
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }

  /** Call a public function as a role and return its single value. */
  async rpc<T = unknown>(who: Who, fn: string, args: unknown[] = []): Promise<T> {
    const params = args.map((_, i) => `$${i + 1}`).join(", ");
    return this.as(who, async (c) => {
      const r = await c.query(`select public.${fn}(${params}) as v`, args);
      return r.rows[0].v as T;
    });
  }

  async createUser(): Promise<string> {
    const r = await this.pool.query("insert into auth.users default values returning id");
    return r.rows[0].id;
  }

  /** Owner + open shop with barbers. Returns ids and a helper to get the live presence code. */
  async createShop(opts: { slug?: string; barbers?: string[]; kinds?: string[] } = {}) {
    const owner = await this.createUser();
    const slug = opts.slug ?? `shop-${randomBytes(3).toString("hex")}`;
    const shopId = await this.rpc<string>(user(owner), "create_shop", [
      slug,
      "صالون تجربة",
      opts.kinds ?? ["men", "kids"],
    ]);
    const barberIds: string[] = [];
    for (const name of opts.barbers ?? ["محمد"]) {
      const r = await this.as(user(owner), (c) =>
        c.query("insert into public.barbers (shop_id, name) values ($1, $2) returning id", [
          shopId,
          name,
        ]),
      );
      barberIds.push(r.rows[0].id);
    }
    await this.rpc(user(owner), "set_queue_open", [shopId, true]);
    const services = await this.pool.query<{ id: string; name: string; kind: string }>(
      "select id, name, kind from public.services where shop_id = $1",
      [shopId],
    );
    const service = (name: string) => services.rows.find((s) => s.name === name)!.id;
    const code = async () =>
      (await this.rpc<{ code: string }>(user(owner), "staff_presence_code", [shopId])).code;
    return { owner, shopId, slug, barberIds, service, code };
  }
}

export type Shop = Awaited<ReturnType<TestDb["createShop"]>>;

let phoneSeq = 0;
/** Unique valid Egyptian mobile per call. */
export const nextPhone = () => `010${String(10_000_000 + ++phoneSeq).slice(-8)}`;

export type JoinOptions = {
  phone?: string;
  barberId?: string | null;
  services?: string[];
  alert?: boolean;
  code?: string;
  name?: string;
  /** Client IP the server would pass. Default: unique per call, so rate limits never trip by accident. */
  clientKey?: string;
};

/** Raw join_queue result: soft errors (bad_code, rate_limited) come back as { error }. */
export async function joinRaw(db: TestDb, shop: Shop, o: JoinOptions = {}) {
  return db.rpc<{ entry_id: string; ticket_no: number; token: string; wants_alert: boolean; error?: string }>(
    server,
    "join_queue",
    [
      o.clientKey ?? `ip-${randomBytes(4).toString("hex")}`,
      shop.slug,
      o.code ?? (await shop.code()),
      o.name ?? "أحمد",
      o.phone ?? nextPhone(),
      o.barberId ?? null,
      o.services ?? [shop.service("قصة شعر")],
      o.alert ?? false,
    ],
  );
}

/** join_queue that throws soft errors too, so every failure reads the same in tests. */
export async function join(db: TestDb, shop: Shop, o: JoinOptions = {}) {
  const r = await joinRaw(db, shop, o);
  if (r.error) throw new Error(r.error);
  return r;
}

/** Expect a promise to fail with one of our error keys (or a Postgres error message fragment). */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return "NO_ERROR";
}
