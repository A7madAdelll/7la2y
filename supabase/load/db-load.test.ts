// Database load test (build plan: 1,000 shops, bursts of 50 joins/s, p95 < 300 ms).
// Runs the real queue functions against Postgres with a pooled connection limit like Supabase's.
// Indicative only when run on a laptop or CI box; rerun against staging hardware before launch.
//   DATABASE_URL=postgres://... npm run load:db        (LOAD_SECONDS=20 by default)
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, hasDb, server, user } from "../tests/db";

const SHOPS = Number(process.env.LOAD_SHOPS ?? 1000);
const SECONDS = Number(process.env.LOAD_SECONDS ?? 20);
const X = Number(process.env.LOAD_X ?? 1); // multiplier for headroom runs
const RATES = { join: 50 * X, next: 20 * X, status: 200 * X }; // per second

type Shop = { id: string; slug: string; owner: string; barbers: string[]; service: string; code: string; current: Map<string, string | null> };

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))] : 0;
};

describe.skipIf(!hasDb)("database load", () => {
  let db: TestDb;
  const shops: Shop[] = [];
  const tokens: string[] = [];

  beforeAll(async () => {
    db = await TestDb.create();
    // Seed directly (fast): owners, shops, secrets, 2 barbers each, default services, open queues.
    await db.pool.query(`
      with u as (insert into auth.users (id) select gen_random_uuid() from generate_series(1, $1) returning id),
      un as (select id, row_number() over () as n from u),
      s as (insert into public.shops (slug, name, kinds, queue_open)
            select 'load-' || n, 'محل ' || n, '{men}', true from un returning id, slug),
      sn as (select id, slug, row_number() over (order by slug) as n from s)
      insert into public.shop_members (shop_id, user_id, role)
      select sn.id, un.id, 'owner' from sn join un using (n)`, [SHOPS]);
    await db.pool.query(`insert into public.shop_secrets (shop_id) select id from public.shops`);
    await db.pool.query(`insert into public.barbers (shop_id, name) select id, b from public.shops, unnest(array['أ','ب']) b`);
    await db.pool.query(`select private.seed_default_services(id, kinds) from public.shops`);
    const rows = await db.pool.query(`
      select s.id, s.slug, m.user_id as owner,
             (select array_agg(b.id) from public.barbers b where b.shop_id = s.id) as barbers,
             (select v.id from public.services v where v.shop_id = s.id and v.name = 'قصة شعر') as service,
             private.presence_code(k.presence_secret, private.presence_window(now())) as code
      from public.shops s join public.shop_secrets k on k.shop_id = s.id
      join public.shop_members m on m.shop_id = s.id`);
    for (const r of rows.rows) shops.push({ ...r, current: new Map(r.barbers.map((b: string) => [b, null])) });
  });
  afterAll(async () => {
    await db?.drop();
  });

  it(`${SHOPS} shops, ${RATES.join} joins/s + ${RATES.next} nexts/s + ${RATES.status} status/s for ${SECONDS}s`, async () => {
    const lat: Record<string, number[]> = { join: [], next: [], status: [] };
    const errors: Record<string, string[]> = { join: [], next: [], status: [] };
    let phone = 10_000_000;
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    const timed = async (kind: keyof typeof lat, fn: () => Promise<unknown>) => {
      const t = performance.now();
      try {
        await fn();
        lat[kind].push(performance.now() - t);
      } catch (e) {
        errors[kind].push((e as Error).message);
      }
    };

    const ops = {
      join: () => timed("join", async () => {
        const s = pick(shops);
        const r = await db.rpc<{ token?: string; error?: string }>(server, "join_queue", [
          `ip-${Math.random()}`, s.slug, s.code, "زبون", `010${++phone}`, null, [s.service], Math.random() < 0.3,
        ]);
        if (r.error && r.error !== "bad_code") throw new Error(r.error); // code may rotate mid-run
        if (r.token) tokens.push(r.token);
      }),
      next: () => timed("next", async () => {
        const s = pick(shops);
        const b = pick(s.barbers);
        const r = await db.rpc<{ result: string; current_entry_id: string | null }>(user(s.owner), "queue_next", [b, s.current.get(b) ?? null]);
        if (r.result === "ok") s.current.set(b, r.current_entry_id);
      }),
      // Customers' pages refetch their status anonymously after each ping.
      status: () => timed("status", async () => {
        if (tokens.length) await db.as({ role: "anon" }, (c) => c.query("select public.entry_status($1)", [pick(tokens)]));
      }),
    };

    const inflight: Promise<unknown>[] = [];
    const end = Date.now() + SECONDS * 1000;
    while (Date.now() < end) {
      const tick = Date.now();
      for (const [kind, rate] of Object.entries(RATES) as [keyof typeof ops, number][]) {
        for (let i = 0; i < rate / 10; i++) inflight.push(ops[kind]());
      }
      await new Promise((r) => setTimeout(r, Math.max(0, 100 - (Date.now() - tick))));
    }
    await Promise.all(inflight);

    const report = Object.fromEntries(
      Object.entries(lat).map(([k, xs]) => [k, { n: xs.length, errors: errors[k].length, p50: Math.round(pct(xs, 50)), p95: Math.round(pct(xs, 95)), p99: Math.round(pct(xs, 99)) }]),
    );
    console.log("LOAD RESULT (ms)", JSON.stringify(report));
    const firstErrors = Object.values(errors).flat().slice(0, 3);
    expect(firstErrors).toEqual([]);
    for (const k of ["join", "next", "status"]) expect(report[k].p95, `${k} p95 ms`).toBeLessThan(300);
  });
});
