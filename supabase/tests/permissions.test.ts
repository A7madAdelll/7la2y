// Regression guard. Supabase grants every new table/function in `public` to the API roles by
// default; a migration that forgets to revoke would silently open data. This test pins the exact
// API surface: change it only on purpose, together with the migration that needs it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, hasDb } from "./db";

const ANON_FUNCTIONS = ["entry_status", "forget_me", "leave_queue", "request_whatsapp_confirm", "shop_public", "tv_board"];
const STAFF_FUNCTIONS = [
  ...ANON_FUNCTIONS,
  "accept_invite", "admin_record_payment", "admin_shops", "alerts_per_month", "counter_state",
  "create_invite", "create_shop", "is_platform_admin", "queue_cancel", "queue_next", "queue_no_show",
  "queue_reorder", "remove_cashier", "rotate_tv_link", "set_barber_on_duty", "set_queue_open",
  "shop_staff", "staff_add_walk_in", "staff_presence_code",
].sort();
const SERVER_FUNCTIONS = ["claim_messages", "complete_message", "confirm_whatsapp", "join_queue", "purge_personal_data", "record_message_status"];

describe.skipIf(!hasDb)("API surface (permissions allowlist)", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await TestDb.create();
  });
  afterAll(async () => {
    await db?.drop();
  });

  const executable = async (role: string, schema = "public") =>
    (await db.pool.query(
      `select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = $2 and has_function_privilege($1, p.oid, 'execute') order by 1`,
      [role, schema],
    )).rows.map((r) => r.proname);

  it("anon (the public key) can call only the customer and TV functions", async () => {
    expect(await executable("anon")).toEqual(ANON_FUNCTIONS);
  });

  it("logged-in users can call only these functions (each checks membership inside)", async () => {
    expect(await executable("authenticated")).toEqual(STAFF_FUNCTIONS);
  });

  it("server-only functions are not reachable with the public key or a login", async () => {
    for (const f of SERVER_FUNCTIONS) {
      expect(ANON_FUNCTIONS.includes(f) || STAFF_FUNCTIONS.includes(f), f).toBe(false);
    }
    expect((await executable("service_role")).filter((f) => SERVER_FUNCTIONS.includes(f)).sort()).toEqual(SERVER_FUNCTIONS);
  });

  it("anon can call nothing in the private schema", async () => {
    expect(await executable("anon", "private")).toEqual([]);
  });

  it("every table in public has RLS on, and anon has no table privileges at all", async () => {
    const noRls = await db.pool.query(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(noRls.rows).toEqual([]);
    const anonTables = await db.pool.query(
      `select table_name, privilege_type from information_schema.role_table_grants
       where grantee = 'anon' and table_schema = 'public'`);
    expect(anonTables.rows).toEqual([]);
  });

  it("every SECURITY DEFINER function pins its search_path", async () => {
    const loose = await db.pool.query(
      `select n.nspname || '.' || p.proname as fn from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private') and p.prosecdef
         and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')`);
    expect(loose.rows).toEqual([]);
  });
});
