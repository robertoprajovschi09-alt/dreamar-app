// =============================================================================
// drea.mar — Backend verification harness
//
// Spins up an in-process Postgres (via pglite), shims Supabase Auth, applies
// every migration + the seed, then runs an assertion suite that proves:
//   1. The SQL applies cleanly.
//   2. The 4 plans are seeded as the spec requires.
//   3. RLS isolates two agencies — user A querying clients sees only A's.
//   4. The cross-tenant write attack (user A inserts a client with B's
//      agency_id) is blocked by RLS WITH CHECK.
//   5. A Client Viewer sees ONLY their assigned client, not the agency's
//      other clients.
//   6. The Starter plan's max_clients=5 limit blocks the 6th client.
//   7. The agency_id immutability trigger blocks UPDATE of agency_id.
//
// Run: node scripts/test-migrations.mjs
// =============================================================================

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

let passed = 0;
let failed = 0;
const failures = [];

function ok(name) { passed++; console.log(`  \x1b[32m✓\x1b[0m ${name}`); }
function fail(name, err) {
  failed++;
  failures.push({ name, err: err?.message ?? String(err) });
  console.log(`  \x1b[31m✗\x1b[0m ${name}\n    ${err?.message ?? err}`);
}

async function expectPass(db, name, fn) {
  try { await fn(); ok(name); } catch (e) { fail(name, e); }
}
async function expectFail(db, name, fn, errIncludes = "") {
  try {
    await fn();
    fail(name, new Error(`expected failure but query succeeded`));
  } catch (e) {
    const msg = e?.message ?? String(e);
    if (errIncludes && !msg.toLowerCase().includes(errIncludes.toLowerCase())) {
      fail(name, new Error(`failed for the wrong reason: ${msg}`));
    } else {
      ok(name);
    }
  }
}

async function main() {
  const db = new PGlite({ extensions: { pgcrypto, citext, pg_trgm } });
  await db.waitReady;

  console.log("\n\x1b[1mApplying shim + migrations + seed…\x1b[0m");

  // 1. Auth shim
  const shim = await readFile(join(__dirname, "db-shim.sql"), "utf8");
  await db.exec(shim);
  console.log("  ✓ auth shim applied");

  // 2. Migrations in order
  const migDir = join(projectRoot, "supabase/migrations");
  const migs = (await readdir(migDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const file of migs) {
    const sql = await readFile(join(migDir, file), "utf8");
    try {
      await db.exec(sql);
      console.log(`  ✓ ${file}`);
    } catch (e) {
      console.log(`  \x1b[31m✗ ${file}\x1b[0m`);
      throw e;
    }
  }

  // 3. Post-migration shim (grants + test helpers)
  const postShim = await readFile(join(__dirname, "db-shim-post.sql"), "utf8");
  await db.exec(postShim);
  console.log("  ✓ post-shim applied");

  // 4. Seed
  const seed = await readFile(join(projectRoot, "supabase/seed.sql"), "utf8");
  await db.exec(seed);
  console.log("  ✓ seed applied");

  // ----------------------- Phase 0 assertions ------------------------------
  console.log("\n\x1b[1mAssertions:\x1b[0m");

  // The 4 plans seeded with the spec's exact prices.
  await expectPass(db, "plans seeded — 4 tiers, exact EUR prices", async () => {
    const r = await db.query(
      "select tier::text, price_eur_monthly::int as price, max_clients, max_team_members from public.plans order by display_order"
    );
    const got = r.rows.map((p) => `${p.tier}:${p.price}/${p.max_clients ?? "∞"}/${p.max_team_members ?? "∞"}`);
    const want = ["starter:99/5/1", "growth:150/15/3", "unlimited:249/∞/∞", "white_label_pro:399/∞/∞"];
    if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`got ${JSON.stringify(got)}`);
  });

  // ----------------------- Tenant isolation setup --------------------------
  // Seed two profiles + two agencies. We bypass triggers/RLS for setup by
  // doing the inserts in the same session pglite runs as superuser; user
  // context only matters for the SELECT queries below.
  const owners = await db.query(`
    insert into auth.users (id, email)
    values
      ('11111111-1111-1111-1111-111111111111', 'a@example.com'),
      ('22222222-2222-2222-2222-222222222222', 'b@example.com')
    returning id, email
  `);
  // Trigger created the profile rows; sanity check.
  const profCount = await db.query("select count(*)::int as n from public.profiles");
  if (profCount.rows[0].n !== 2) {
    fail("auth → profile trigger", new Error(`expected 2 profiles, got ${profCount.rows[0].n}`));
  } else {
    ok("auth → profile trigger mirrors auth.users into public.profiles");
  }

  const agencyA = "aaaa1111-1111-1111-1111-111111111111";
  const agencyB = "bbbb2222-2222-2222-2222-222222222222";
  await db.exec(`
    insert into public.agencies (id, name, slug, current_plan_tier)
    values
      ('${agencyA}', 'Agency A', 'agency-a', 'starter'),
      ('${agencyB}', 'Agency B', 'agency-b', 'unlimited');

    insert into public.agency_members (agency_id, profile_id, role)
    values
      ('${agencyA}', '11111111-1111-1111-1111-111111111111', 'agency_owner'),
      ('${agencyB}', '22222222-2222-2222-2222-222222222222', 'agency_owner');

    insert into public.clients (agency_id, name, niche)
    values
      ('${agencyA}', 'A-Client-1', 'real_estate'),
      ('${agencyA}', 'A-Client-2', 'fitness_gym'),
      ('${agencyB}', 'B-Client-1', 'restaurant');
  `);

  // RLS isolation: user A only sees A's clients.
  await expectPass(db, "RLS: agency A sees ONLY A's clients", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select name from public.clients order by name");
    const names = r.rows.map((x) => x.name);
    if (JSON.stringify(names) !== JSON.stringify(["A-Client-1", "A-Client-2"])) {
      throw new Error(`leaked: ${JSON.stringify(names)}`);
    }
  });

  await expectPass(db, "RLS: agency B sees ONLY B's clients", async () => {
    await db.query("select public.test_set_user('22222222-2222-2222-2222-222222222222')");
    const r = await db.query("select name from public.clients order by name");
    const names = r.rows.map((x) => x.name);
    if (JSON.stringify(names) !== JSON.stringify(["B-Client-1"])) {
      throw new Error(`leaked: ${JSON.stringify(names)}`);
    }
  });

  // Cross-tenant write attack — user A tries to insert a client into B.
  await expectFail(db, "RLS: cross-tenant INSERT (user A → agency B) is blocked", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    await db.query(`insert into public.clients (agency_id, name) values ('${agencyB}', 'evil')`);
  }, "row-level security");

  // agency_id immutability — user A tries to move their client to B.
  await expectFail(db, "trigger: agency_id is immutable across UPDATE", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    await db.query(`update public.clients set agency_id = '${agencyB}' where name = 'A-Client-1'`);
  }, "immutable");

  // Client Viewer scoping — a Client Viewer assigned to a single client sees
  // only THAT client, not the agency's other clients.
  await db.query("select public.test_clear_user()"); // back to superuser for setup
  const viewerId = "33333333-3333-3333-3333-333333333333";
  await db.exec(`
    insert into auth.users (id, email) values ('${viewerId}', 'viewer@example.com');

    -- Wire the viewer to A-Client-1 only.
    insert into public.client_users (agency_id, client_id, profile_id)
    select '${agencyA}', id, '${viewerId}'
      from public.clients where name = 'A-Client-1';
  `);
  await expectPass(db, "Client Viewer sees ONLY their assigned client", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select name from public.clients order by name");
    const names = r.rows.map((x) => x.name);
    if (JSON.stringify(names) !== JSON.stringify(["A-Client-1"])) {
      throw new Error(`viewer saw ${JSON.stringify(names)}`);
    }
  });

  // Plan limit — Starter caps clients at 5. Agency A already has 2 → adding
  // 3 more should succeed, the 6th should be rejected by the trigger.
  await db.query("select public.test_clear_user()"); // back to superuser for setup
  await db.exec(`
    insert into public.clients (agency_id, name) values
      ('${agencyA}', 'A-3'), ('${agencyA}', 'A-4'), ('${agencyA}', 'A-5');
  `);
  await expectFail(db, "plan limit: Starter's 6th client is rejected", async () => {
    await db.query(`insert into public.clients (agency_id, name) values ('${agencyA}', 'A-6')`);
  }, "plan_limit_exceeded");

  // usage_counters reflects the count.
  await expectPass(db, "usage_counters: client_count matches reality", async () => {
    const r = await db.query(`select client_count from public.usage_counters where agency_id = '${agencyA}'`);
    if (r.rows[0].client_count !== 5) throw new Error(`got ${r.rows[0].client_count}`);
  });

  // Public read on plans as anonymous role.
  await expectPass(db, "plans table is publicly readable (anonymous)", async () => {
    await db.query("select public.test_set_anon()");
    const r = await db.query("select count(*)::int as n from public.plans");
    if (r.rows[0].n !== 4) throw new Error(`got ${r.rows[0].n}`);
  });

  // Anonymous CANNOT see clients — either by GRANT denial or by RLS returning 0.
  // Both outcomes satisfy the contract: no tenant data ever leaks to anon.
  await expectPass(db, "anon role gets no client data (GRANT or RLS blocks)", async () => {
    await db.query("select public.test_set_anon()");
    try {
      const r = await db.query("select count(*)::int as n from public.clients");
      if (r.rows[0].n !== 0) throw new Error(`anon leaked ${r.rows[0].n} clients via RLS`);
    } catch (e) {
      // GRANT denial is the stronger outcome — accept it.
      if (!String(e.message ?? e).toLowerCase().includes("permission denied")) throw e;
    }
  });

  // ------------------------- Phase 1 assertions --------------------------
  console.log("\n\x1b[1mPhase 1 — Calendar / Approvals / Tasks:\x1b[0m");

  // Back to superuser for setup.
  await db.query("select public.test_clear_user()");

  // Get the existing client IDs for posts.
  const cidA1 = (await db.query(`select id from public.clients where name = 'A-Client-1'`)).rows[0].id;
  const cidA2 = (await db.query(`select id from public.clients where name = 'A-Client-2'`)).rows[0].id;
  const cidB1 = (await db.query(`select id from public.clients where name = 'B-Client-1'`)).rows[0].id;

  await db.exec(`
    insert into public.content_posts (agency_id, client_id, title, status, platform)
    values
      ('${agencyA}', '${cidA1}', 'A-post-1 — property tour', 'idea', 'tiktok'),
      ('${agencyA}', '${cidA2}', 'A-post-2 — transformation reel', 'script', 'instagram'),
      ('${agencyB}', '${cidB1}', 'B-post-1 — menu skit', 'editing', 'instagram');
  `);

  // RLS: posts isolated by agency, same as clients.
  await expectPass(db, "RLS: agency A sees ONLY A's posts", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select title from public.content_posts order by title");
    const titles = r.rows.map((x) => x.title);
    if (titles.length !== 2 || titles.some((t) => t.startsWith("B-"))) {
      throw new Error(`got ${JSON.stringify(titles)}`);
    }
  });

  // Trigger: pairing a post's agency with a client from a different agency
  // is rejected (defence-in-depth on top of RLS).
  await expectFail(db, "trigger: post pairs agency_id and client_id consistently", async () => {
    await db.query("select public.test_clear_user()");
    await db.query(
      `insert into public.content_posts (agency_id, client_id, title) values ('${agencyA}', '${cidB1}', 'evil')`
    );
  }, "belongs to agency");

  // Client Viewer sees ONLY posts for THEIR client. (Viewer is wired to A-Client-1.)
  await expectPass(db, "Client Viewer sees ONLY posts for their assigned client", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select title from public.content_posts order by title");
    const titles = r.rows.map((x) => x.title);
    if (JSON.stringify(titles) !== JSON.stringify(["A-post-1 — property tour"])) {
      throw new Error(`viewer saw ${JSON.stringify(titles)}`);
    }
  });

  // ---- Feature-gate: Starter agency cannot create approvals ----
  // Agency A is on starter. The trigger should reject the INSERT.
  await db.query("select public.test_clear_user()");
  const postA1Id = (await db.query(`select id from public.content_posts where title = 'A-post-1 — property tour'`)).rows[0].id;
  await expectFail(db, "feature gate: Starter agency cannot create approvals", async () => {
    await db.query(`
      insert into public.approvals (agency_id, client_id, entity_type, entity_id, reviewer_id)
      values ('${agencyA}', '${cidA1}', 'post', '${postA1Id}', '${viewerId}')
    `);
  }, "plan_feature_required");

  // Upgrade Agency A to growth, then the same INSERT should succeed.
  await db.exec(`update public.agencies set current_plan_tier = 'growth' where id = '${agencyA}'`);
  await expectPass(db, "after upgrade, Growth agency CAN create approvals", async () => {
    await db.query(`
      insert into public.approvals (agency_id, client_id, entity_type, entity_id, reviewer_id)
      values ('${agencyA}', '${cidA1}', 'post', '${postA1Id}', '${viewerId}')
    `);
  });

  // Sync trigger: the post's approval_status should now be 'pending'.
  await expectPass(db, "trigger: content_posts.approval_status syncs from approvals", async () => {
    const r = await db.query(`select approval_status from public.content_posts where id = '${postA1Id}'`);
    if (r.rows[0].approval_status !== "pending") throw new Error(`got ${r.rows[0].approval_status}`);
  });

  // Client Viewer DECIDES the approval (the portal flow).
  await expectPass(db, "Client Viewer can decide their pending approval", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`
      update public.approvals
         set status = 'approved'
       where entity_id = '${postA1Id}'
    `);
    // The trigger should have stamped decided_by + decided_at.
    await db.query("select public.test_clear_user()");
    const r = await db.query(`
      select status::text, decided_by, decided_at is not null as decided
      from public.approvals where entity_id = '${postA1Id}'
    `);
    if (r.rows[0].status !== "approved") throw new Error(`status ${r.rows[0].status}`);
    if (r.rows[0].decided_by !== viewerId) throw new Error(`decided_by ${r.rows[0].decided_by}`);
    if (!r.rows[0].decided) throw new Error(`decided_at not set`);
    // And the post's denormalized status should follow.
    const p = await db.query(`select approval_status from public.content_posts where id = '${postA1Id}'`);
    if (p.rows[0].approval_status !== "approved") throw new Error(`post sync: ${p.rows[0].approval_status}`);
  });

  // Cross-tenant: Client Viewer of A's client CANNOT decide B's approvals.
  // Set up an approval on B (Unlimited plan, so feature is on).
  await db.query("select public.test_clear_user()");
  const postB1Id = (await db.query(`select id from public.content_posts where title = 'B-post-1 — menu skit'`)).rows[0].id;
  await db.exec(`
    insert into public.approvals (agency_id, client_id, entity_type, entity_id)
    values ('${agencyB}', '${cidB1}', 'post', '${postB1Id}')
  `);
  await expectPass(db, "Client Viewer of A cannot see B's approvals", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query(`select count(*)::int as n from public.approvals where entity_id = '${postB1Id}'`);
    if (r.rows[0].n !== 0) throw new Error(`leaked ${r.rows[0].n}`);
  });

  // ---- Tasks: isolation + completed_at trigger ----
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.tasks (agency_id, client_id, title, priority, status)
    values
      ('${agencyA}', '${cidA1}', 'A-task-1 — film walkthrough', 'high', 'todo'),
      ('${agencyA}', null, 'A-task-2 — internal ops', 'low', 'in_progress'),
      ('${agencyB}', '${cidB1}', 'B-task-1 — edit reel', 'medium', 'todo');
  `);

  await expectPass(db, "RLS: agency A sees ONLY A's tasks", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select title from public.tasks order by title");
    const titles = r.rows.map((x) => x.title);
    if (titles.length !== 2 || titles.some((t) => t.startsWith("B-"))) {
      throw new Error(`got ${JSON.stringify(titles)}`);
    }
  });

  // Client Viewer must NOT see tasks (tasks are internal).
  await expectPass(db, "Client Viewer sees ZERO tasks (tasks are internal)", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.tasks");
    if (r.rows[0].n !== 0) throw new Error(`viewer saw ${r.rows[0].n} tasks`);
  });

  // completed_at trigger: moving a task to done stamps completed_at;
  // moving it back unstamps.
  await expectPass(db, "trigger: tasks.completed_at stamps/unstamps with status", async () => {
    await db.query("select public.test_clear_user()");
    const tid = (await db.query(`select id from public.tasks where title = 'A-task-1 — film walkthrough'`)).rows[0].id;

    await db.query(`update public.tasks set status = 'done' where id = '${tid}'`);
    let r = await db.query(`select completed_at is not null as done from public.tasks where id = '${tid}'`);
    if (!r.rows[0].done) throw new Error("completed_at not stamped");

    await db.query(`update public.tasks set status = 'todo' where id = '${tid}'`);
    r = await db.query(`select completed_at is null as cleared from public.tasks where id = '${tid}'`);
    if (!r.rows[0].cleared) throw new Error("completed_at not cleared on un-done");
  });

  // ------------------------- Phase 2 assertions --------------------------
  console.log("\n\x1b[1mPhase 2 — Videos / Hooks / Analytics:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // A library hook for agency A, pinned to A-Client-1.
  await db.exec(`
    insert into public.hooks (agency_id, client_id, text, niche, platform, pattern)
    values ('${agencyA}', '${cidA1}', 'This €450k apartment sold in 3 days because…', 'real_estate', 'tiktok', 'Curiosity + price anchor');
    insert into public.hooks (agency_id, client_id, text, niche, platform)
    values ('${agencyB}', '${cidB1}', 'We let a 4-year-old design the menu', 'restaurant', 'tiktok');
  `);
  const hookA = (await db.query(`select id from public.hooks where agency_id = '${agencyA}'`)).rows[0].id;

  // Two videos for A-Client-1, both using hookA, ai_score 90 and 80.
  await db.exec(`
    insert into public.videos (agency_id, client_id, hook_id, platform, hook, ai_score, views, recommendation)
    values
      ('${agencyA}', '${cidA1}', '${hookA}', 'tiktok', 'This €450k apartment sold…', 90, 184200, 'repeat'),
      ('${agencyA}', '${cidA1}', '${hookA}', 'tiktok', 'This €450k apartment sold…', 80, 96400, 'repeat'),
      ('${agencyB}', '${cidB1}', null, 'instagram', 'B hook', 60, 7400, 'improve');
  `);

  // The hook-stats trigger should have set uses=2, avg_ai_score=85.
  await expectPass(db, "trigger: hook stats recompute (uses=2, avg=85.00)", async () => {
    const r = await db.query(`select uses, avg_ai_score::text from public.hooks where id = '${hookA}'`);
    if (r.rows[0].uses !== 2) throw new Error(`uses=${r.rows[0].uses}`);
    if (Number(r.rows[0].avg_ai_score) !== 85) throw new Error(`avg=${r.rows[0].avg_ai_score}`);
  });

  // Editing a video's ai_score recomputes the hook average.
  await expectPass(db, "trigger: editing video ai_score updates hook average", async () => {
    await db.query(`update public.videos set ai_score = 100 where ai_score = 90 and hook_id = '${hookA}'`);
    const r = await db.query(`select avg_ai_score::text from public.hooks where id = '${hookA}'`);
    if (Number(r.rows[0].avg_ai_score) !== 90) throw new Error(`avg=${r.rows[0].avg_ai_score} (want 90 = (100+80)/2)`);
  });

  // RLS: videos isolated by agency.
  await expectPass(db, "RLS: agency A sees ONLY A's videos", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select count(*)::int as n from public.videos");
    if (r.rows[0].n !== 2) throw new Error(`A saw ${r.rows[0].n} videos`);
  });

  // Client Viewer CAN see their client's videos (portal performance view).
  await expectPass(db, "Client Viewer CAN see their client's videos (portal)", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.videos");
    if (r.rows[0].n !== 2) throw new Error(`viewer saw ${r.rows[0].n} (want 2 for A-Client-1)`);
  });

  // Client Viewer CANNOT see the hook library (internal agency tool).
  await expectPass(db, "Client Viewer sees ZERO hooks (library is internal)", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.hooks");
    if (r.rows[0].n !== 0) throw new Error(`viewer saw ${r.rows[0].n} hooks`);
  });

  // Client Viewer CANNOT write a video (read-only in portal).
  await expectFail(db, "Client Viewer cannot INSERT a video", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`insert into public.videos (agency_id, client_id, platform) values ('${agencyA}', '${cidA1}', 'tiktok')`);
  }, "row-level security");

  // Cross-agency ref guard: a video can't link a hook from another agency.
  await expectFail(db, "trigger: video cannot reference another agency's hook", async () => {
    await db.query("select public.test_clear_user()");
    const hookB = (await db.query(`select id from public.hooks where agency_id = '${agencyB}'`)).rows[0].id;
    await db.query(`insert into public.videos (agency_id, client_id, hook_id) values ('${agencyA}', '${cidA1}', '${hookB}')`);
  }, "not in agency");

  // Manual analytics: snapshot uniqueness per client+platform+date.
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.metric_snapshots (agency_id, client_id, platform, snapshot_date, followers)
    values ('${agencyA}', '${cidA1}', 'instagram', '2026-06-01', 12500);
  `);
  await expectFail(db, "metric_snapshots: unique (client, platform, date) enforced", async () => {
    await db.query(`
      insert into public.metric_snapshots (agency_id, client_id, platform, snapshot_date, followers)
      values ('${agencyA}', '${cidA1}', 'instagram', '2026-06-01', 12800)
    `);
  }, "duplicate key");

  // Client Viewer CAN see their client's analytics (portal), not B's.
  await expectPass(db, "Client Viewer CAN see their client's analytics", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.metric_snapshots");
    if (r.rows[0].n !== 1) throw new Error(`viewer saw ${r.rows[0].n}`);
  });

  // The calendar ↔ video FK: deleting a video nulls the post's video_id
  // rather than orphaning or blocking.
  await expectPass(db, "FK: deleting a video sets content_posts.video_id to null", async () => {
    await db.query("select public.test_clear_user()");
    // Link A-post-1 to one of A's videos, then delete that video.
    const vid = (await db.query(`select id from public.videos where agency_id = '${agencyA}' limit 1`)).rows[0].id;
    await db.query(`update public.content_posts set video_id = '${vid}' where id = '${postA1Id}'`);
    await db.query(`delete from public.videos where id = '${vid}'`);
    const r = await db.query(`select video_id from public.content_posts where id = '${postA1Id}'`);
    if (r.rows[0].video_id !== null) throw new Error(`video_id not nulled: ${r.rows[0].video_id}`);
  });

  // ------------------------- Phase 3 assertions --------------------------
  console.log("\n\x1b[1mPhase 3 — Business Impact / Health Score:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // Agency member records an impact row.
  await db.exec(`
    insert into public.business_impact_entries (agency_id, client_id, period_month, source, calls_received, sales, revenue_estimate)
    values ('${agencyA}', '${cidA1}', '2026-06-01', 'agency', 42, 31, 430000);
  `);

  await expectPass(db, "RLS: agency A sees its impact entry; B does not", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const a = await db.query("select count(*)::int as n from public.business_impact_entries");
    await db.query("select public.test_set_user('22222222-2222-2222-2222-222222222222')");
    const b = await db.query("select count(*)::int as n from public.business_impact_entries");
    if (a.rows[0].n !== 1 || b.rows[0].n !== 0) throw new Error(`A=${a.rows[0].n} B=${b.rows[0].n}`);
  });

  // Client Viewer CAN submit their own impact form (source='client').
  await expectPass(db, "Client Viewer can submit impact (source='client')", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`
      insert into public.business_impact_entries (agency_id, client_id, period_month, source, bookings, qualitative_feedback)
      values ('${agencyA}', '${cidA1}', '2026-06-01', 'client', 12, 'Lots of weekend interest')
    `);
    const r = await db.query("select count(*)::int as n from public.business_impact_entries");
    // Viewer should see BOTH the agency row and their own client row for A-Client-1.
    if (r.rows[0].n !== 2) throw new Error(`viewer saw ${r.rows[0].n}`);
  });

  // Client Viewer CANNOT submit a row claiming source='agency'.
  await expectFail(db, "Client Viewer cannot submit impact with source='agency'", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`
      insert into public.business_impact_entries (agency_id, client_id, period_month, source, sales)
      values ('${agencyA}', '${cidA1}', '2026-05-01', 'agency', 99)
    `);
  }, "row-level security");

  // Client Viewer CANNOT submit for a different client (cross-tenant).
  await expectFail(db, "Client Viewer cannot submit impact for another client", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`
      insert into public.business_impact_entries (agency_id, client_id, period_month, source, sales)
      values ('${agencyB}', '${cidB1}', '2026-06-01', 'client', 5)
    `);
  }, "row-level security");

  // ---- Health score: the column-leak fix ----
  // clients.health_score / risk must no longer exist (moved off the table).
  await expectPass(db, "leak fix: clients.health_score & risk columns are gone", async () => {
    await db.query("select public.test_clear_user()");
    const r = await db.query(`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = 'clients'
        and column_name in ('health_score', 'risk')
    `);
    if (r.rows.length !== 0) throw new Error(`still present: ${r.rows.map((x) => x.column_name).join(", ")}`);
  });

  // Agency records a health score with no risk → trigger derives 'high'.
  await db.exec(`
    insert into public.client_health_scores (agency_id, client_id, score, components, ai_rationale)
    values ('${agencyA}', '${cidA1}', 48, '{"overdue_tasks": 80}'::jsonb, 'Approvals slipping');
  `);
  await expectPass(db, "trigger: health risk auto-derived from score (48 → high)", async () => {
    const r = await db.query(`select risk::text from public.client_health_scores where client_id = '${cidA1}'`);
    if (r.rows[0].risk !== "high") throw new Error(`risk=${r.rows[0].risk}`);
  });

  // The KEY test: a Client Viewer cannot see health scores at all.
  await expectPass(db, "leak fix: Client Viewer sees ZERO health scores", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const t = await db.query("select count(*)::int as n from public.client_health_scores");
    if (t.rows[0].n !== 0) throw new Error(`viewer saw ${t.rows[0].n} health rows`);
    // And the convenience view inherits the same RLS (security_invoker).
    const v = await db.query("select count(*)::int as n from public.client_current_health");
    if (v.rows[0].n !== 0) throw new Error(`viewer saw ${v.rows[0].n} via view`);
  });

  // Agency member CAN see health + the current-health view returns latest.
  await expectPass(db, "view: client_current_health returns the latest score", async () => {
    await db.query("select public.test_clear_user()");
    // Newer, better score.
    await db.query(`
      insert into public.client_health_scores (agency_id, client_id, score, ai_rationale)
      values ('${agencyA}', '${cidA1}', 86, 'Recovered — strong June')
    `);
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query(`select score, risk::text from public.client_current_health where client_id = '${cidA1}'`);
    if (r.rows.length !== 1) throw new Error(`view returned ${r.rows.length} rows`);
    if (r.rows[0].score !== 86 || r.rows[0].risk !== "low") {
      throw new Error(`current = ${r.rows[0].score}/${r.rows[0].risk} (want 86/low)`);
    }
  });

  // ------------------------- Phase 4 assertions --------------------------
  // State: agency A = growth (has ai_reports, NOT ai_strategy_room);
  //        agency B = unlimited (has both).
  console.log("\n\x1b[1mPhase 4 — AI Reports / Strategy / Jobs:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // ai_reports feature gate: downgrade A to starter, insert must fail.
  await expectFail(db, "feature gate: Starter agency cannot create AI reports", async () => {
    await db.exec(`update public.agencies set current_plan_tier = 'starter' where id = '${agencyA}'`);
    await db.query(`insert into public.ai_reports (agency_id, client_id, period_month) values ('${agencyA}', '${cidA1}', '2026-06-01')`);
  }, "plan_feature_required");
  await db.exec(`update public.agencies set current_plan_tier = 'growth' where id = '${agencyA}'`);

  // Growth agency CAN create a report, and it starts with the 13 spec sections.
  await expectPass(db, "Growth agency creates a report seeded with 13 sections", async () => {
    await db.query(`insert into public.ai_reports (agency_id, client_id, period_month) values ('${agencyA}', '${cidA1}', '2026-06-01')`);
    const r = await db.query(`select jsonb_array_length(sections) as n, status::text from public.ai_reports where client_id = '${cidA1}'`);
    if (r.rows[0].n !== 13) throw new Error(`sections=${r.rows[0].n}`);
    if (r.rows[0].status !== "draft") throw new Error(`status=${r.rows[0].status}`);
  });
  const reportId = (await db.query(`select id from public.ai_reports where client_id = '${cidA1}'`)).rows[0].id;

  // Client portal: a Client Viewer cannot see a DRAFT report…
  await expectPass(db, "Client Viewer cannot see a draft report", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.ai_reports");
    if (r.rows[0].n !== 0) throw new Error(`viewer saw ${r.rows[0].n} draft reports`);
  });

  // …but CAN once it's sent.
  await expectPass(db, "Client Viewer CAN see a sent report (portal)", async () => {
    await db.query("select public.test_clear_user()");
    await db.query(`update public.ai_reports set status = 'sent' where id = '${reportId}'`);
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.ai_reports");
    if (r.rows[0].n !== 1) throw new Error(`viewer saw ${r.rows[0].n}`);
  });

  // sent_at trigger fired.
  await expectPass(db, "trigger: ai_reports.sent_at stamps on first send", async () => {
    await db.query("select public.test_clear_user()");
    const r = await db.query(`select sent_at is not null as sent from public.ai_reports where id = '${reportId}'`);
    if (!r.rows[0].sent) throw new Error("sent_at not stamped");
  });

  // ---- Strategy room: the higher (Unlimited) feature gate ----
  // A is growth → strategy thread insert is blocked.
  await expectFail(db, "feature gate: Growth agency cannot open a Strategy Room", async () => {
    await db.query(`insert into public.ai_strategy_threads (agency_id, client_id, title) values ('${agencyA}', '${cidA1}', 'plan A')`);
  }, "plan_feature_required");

  // B is unlimited → it can.
  await expectPass(db, "Unlimited agency CAN open a Strategy Room thread", async () => {
    await db.query(`insert into public.ai_strategy_threads (agency_id, client_id, title) values ('${agencyB}', '${cidB1}', 'next month plan')`);
  });
  const threadB = (await db.query(`select id from public.ai_strategy_threads where agency_id = '${agencyB}'`)).rows[0].id;

  // Strategy message bumps the thread's last_message_at.
  await expectPass(db, "trigger: strategy message updates thread.last_message_at", async () => {
    await db.query(`
      insert into public.ai_strategy_messages (agency_id, thread_id, role, content)
      values ('${agencyB}', '${threadB}', 'user', 'Which hooks worked best?')
    `);
    const r = await db.query(`select last_message_at is not null as bumped from public.ai_strategy_threads where id = '${threadB}'`);
    if (!r.rows[0].bumped) throw new Error("last_message_at not bumped");
  });

  // Strategy room is agency-internal: Client Viewer sees ZERO threads/messages.
  await expectPass(db, "Client Viewer sees ZERO strategy threads (internal)", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const t = await db.query("select count(*)::int as n from public.ai_strategy_threads");
    const m = await db.query("select count(*)::int as n from public.ai_strategy_messages");
    if (t.rows[0].n !== 0 || m.rows[0].n !== 0) throw new Error(`viewer saw ${t.rows[0].n} threads / ${m.rows[0].n} msgs`);
  });

  // ---- AI usage metering rolls up into usage_counters ----
  await expectPass(db, "trigger: ai_usage credits roll up into usage_counters", async () => {
    await db.query("select public.test_clear_user()");
    const before = (await db.query(`select ai_credits_used from public.usage_counters where agency_id = '${agencyA}'`)).rows[0].ai_credits_used;
    await db.query(`
      insert into public.ai_usage (agency_id, feature, model, prompt_tokens, completion_tokens, credits)
      values ('${agencyA}', 'report_generation', 'claude-opus-4-8', 4200, 1800, 5)
    `);
    const after = (await db.query(`select ai_credits_used from public.usage_counters where agency_id = '${agencyA}'`)).rows[0].ai_credits_used;
    if (after - before !== 5) throw new Error(`credits delta = ${after - before} (want 5)`);
  });

  // ---- AI jobs queue timing ----
  await expectPass(db, "trigger: ai_jobs stamps started_at / finished_at on transition", async () => {
    await db.query(`
      insert into public.ai_jobs (agency_id, client_id, type, input_ref, requested_by)
      values ('${agencyA}', '${cidA1}', 'report_generation', '{"report_id":"${reportId}"}'::jsonb, null)
    `);
    const jid = (await db.query(`select id from public.ai_jobs where agency_id = '${agencyA}' limit 1`)).rows[0].id;
    await db.query(`update public.ai_jobs set status = 'running' where id = '${jid}'`);
    let r = await db.query(`select started_at is not null as started, finished_at is null as not_finished from public.ai_jobs where id = '${jid}'`);
    if (!r.rows[0].started || !r.rows[0].not_finished) throw new Error("started_at not stamped or finished prematurely");
    await db.query(`update public.ai_jobs set status = 'succeeded' where id = '${jid}'`);
    r = await db.query(`select finished_at is not null as finished from public.ai_jobs where id = '${jid}'`);
    if (!r.rows[0].finished) throw new Error("finished_at not stamped");
  });

  // ------------------------- Phase 5 assertions --------------------------
  console.log("\n\x1b[1mPhase 5 — Documents / Storage RLS:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // Document metadata rows: one client doc + one agency-wide for A, one for B.
  await db.exec(`
    insert into public.documents (agency_id, client_id, storage_path, filename, mime_type)
    values
      ('${agencyA}', '${cidA1}', '${agencyA}/${cidA1}/brief.pdf',  'June Brief.pdf', 'application/pdf'),
      ('${agencyA}', null,        '${agencyA}/_agency/logo.png',    'Logo.png',       'image/png'),
      ('${agencyB}', '${cidB1}', '${agencyB}/${cidB1}/menu.pdf',  'Menu.pdf',       'application/pdf');
    insert into public.folders (agency_id, client_id, name)
    values ('${agencyA}', '${cidA1}', 'Briefs');
    insert into public.document_ai (agency_id, document_id, status, summary)
    select '${agencyA}', id, 'ready', 'Brand system: navy + gold' from public.documents where filename = 'June Brief.pdf';
  `);

  // Documents: agency isolation.
  await expectPass(db, "RLS: agency A sees ONLY A's documents", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select count(*)::int as n from public.documents");
    if (r.rows[0].n !== 2) throw new Error(`A saw ${r.rows[0].n}`);
  });

  // Client Viewer sees only their CLIENT's documents (not the agency-wide one).
  await expectPass(db, "Client Viewer sees only their client's documents", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select filename from public.documents order by filename");
    const names = r.rows.map((x) => x.filename);
    if (JSON.stringify(names) !== JSON.stringify(["June Brief.pdf"])) throw new Error(`viewer saw ${JSON.stringify(names)}`);
  });

  // Client Viewer CAN upload a document metadata row for their client.
  await expectPass(db, "Client Viewer can add a document for their client", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`
      insert into public.documents (agency_id, client_id, storage_path, filename)
      values ('${agencyA}', '${cidA1}', '${agencyA}/${cidA1}/portal-upload.pdf', 'Portal Upload.pdf')
    `);
    const r = await db.query("select count(*)::int as n from public.documents");
    if (r.rows[0].n !== 2) throw new Error(`viewer now sees ${r.rows[0].n}`);
  });

  // Folders + AI summaries are agency-internal: Client Viewer sees ZERO.
  await expectPass(db, "Client Viewer sees ZERO folders & document_ai (internal)", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const f = await db.query("select count(*)::int as n from public.folders");
    const ai = await db.query("select count(*)::int as n from public.document_ai");
    if (f.rows[0].n !== 0 || ai.rows[0].n !== 0) throw new Error(`viewer saw ${f.rows[0].n} folders / ${ai.rows[0].n} ai`);
  });

  // ---- Storage object RLS (the new surface) ----
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into storage.objects (bucket_id, name) values
      ('documents', '${agencyA}/${cidA1}/brief.pdf'),
      ('documents', '${agencyA}/_agency/logo.png'),
      ('documents', '${agencyB}/${cidB1}/menu.pdf');
  `);

  await expectPass(db, "storage: agency A member sees its 2 objects, not B's", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select count(*)::int as n from storage.objects");
    if (r.rows[0].n !== 2) throw new Error(`A saw ${r.rows[0].n} objects`);
  });

  await expectPass(db, "storage: Client Viewer sees ONLY their client's object", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select name from storage.objects order by name");
    const names = r.rows.map((x) => x.name);
    if (JSON.stringify(names) !== JSON.stringify([`${agencyA}/${cidA1}/brief.pdf`])) {
      throw new Error(`viewer saw ${JSON.stringify(names)}`);
    }
  });

  await expectPass(db, "storage: Client Viewer can UPLOAD to their client's folder", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`insert into storage.objects (bucket_id, name) values ('documents', '${agencyA}/${cidA1}/upload.pdf')`);
  });

  await expectFail(db, "storage: Client Viewer CANNOT upload to the _agency folder", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`insert into storage.objects (bucket_id, name) values ('documents', '${agencyA}/_agency/sneaky.pdf')`);
  }, "row-level security");

  await expectFail(db, "storage: Client Viewer CANNOT upload into another agency", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`insert into storage.objects (bucket_id, name) values ('documents', '${agencyB}/${cidB1}/evil.pdf')`);
  }, "row-level security");

  // ------------------------- Phase 6 assertions --------------------------
  console.log("\n\x1b[1mPhase 6 — Niche dashboards:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // All 10 niches have a seeded system-default config.
  await expectPass(db, "niche_config: 10 system defaults seeded", async () => {
    const r = await db.query("select count(*)::int as n from public.niche_config where agency_id is null");
    if (r.rows[0].n !== 10) throw new Error(`got ${r.rows[0].n}`);
  });

  // Resolver returns the system default when the agency has no override.
  await expectPass(db, "niche_config_for: falls back to system default", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query(`select public.niche_config_for('${agencyA}', 'restaurant') -> 'kpis' as kpis`);
    const kpis = r.rows[0].kpis;
    if (!Array.isArray(kpis) || !kpis.includes("reservations")) throw new Error(`got ${JSON.stringify(kpis)}`);
  });

  // An agency override wins; another agency still gets the default.
  await expectPass(db, "niche_config override wins for the owning agency only", async () => {
    await db.query("select public.test_clear_user()");
    await db.query(`
      insert into public.niche_config (agency_id, niche, config)
      values ('${agencyA}', 'restaurant', '{"kpis":["covers","upsell_rate"]}')
    `);
    const a = await db.query(`select public.niche_config_for('${agencyA}', 'restaurant') -> 'kpis' as kpis`);
    const b = await db.query(`select public.niche_config_for('${agencyB}', 'restaurant') -> 'kpis' as kpis`);
    if (!a.rows[0].kpis.includes("covers")) throw new Error(`A override not applied: ${JSON.stringify(a.rows[0].kpis)}`);
    if (!b.rows[0].kpis.includes("reservations")) throw new Error(`B should still get default: ${JSON.stringify(b.rows[0].kpis)}`);
  });

  // The system default is read-only to users: an owner's UPDATE matches zero
  // rows under RLS (no error, but the row is genuinely untouched).
  await expectPass(db, "niche_config: system default is unmodifiable by users", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    await db.query(`update public.niche_config set version = 99 where agency_id is null and niche = 'hotel'`);
    await db.query("select public.test_clear_user()");
    const r = await db.query(`select version from public.niche_config where agency_id is null and niche = 'hotel'`);
    if (r.rows[0].version !== 1) throw new Error(`system default was modified: version=${r.rows[0].version}`);
  });

  // Generic niche metrics: agency-isolated, client-portal readable.
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.client_niche_metrics (agency_id, client_id, niche, period_month, metrics)
    values ('${agencyA}', '${cidA1}', 'real_estate', '2026-06-01',
            '{"promoted_properties":14,"viewings_booked":37,"offers_received":9,"cost_per_lead":6.4}');
    insert into public.client_niche_metrics (agency_id, client_id, niche, period_month, metrics)
    values ('${agencyB}', '${cidB1}', 'restaurant', '2026-06-01', '{"reservations":312}');
  `);
  await expectPass(db, "client_niche_metrics: agency-isolated", async () => {
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const r = await db.query("select count(*)::int as n from public.client_niche_metrics");
    if (r.rows[0].n !== 1) throw new Error(`A saw ${r.rows[0].n}`);
  });
  await expectPass(db, "client_niche_metrics: Client Viewer reads their client's metrics", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query(`select (metrics->>'viewings_booked')::int as v from public.client_niche_metrics`);
    if (r.rows.length !== 1 || r.rows[0].v !== 37) throw new Error(`viewer got ${JSON.stringify(r.rows)}`);
  });

  // Real-estate detail table: properties — agency write, portal read.
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.properties (agency_id, client_id, name, property_type, price, viewings_booked, offers_received, status)
    values
      ('${agencyA}', '${cidA1}', 'Altmark Sky 2BR', 'Apartment', 189000, 11, 3, 'Reserved'),
      ('${agencyA}', '${cidA1}', 'Old Town Loft',   'Loft',      162000, 6,  1, 'Available');
  `);
  await expectPass(db, "properties: Client Viewer reads their client's properties", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    const r = await db.query("select count(*)::int as n from public.properties");
    if (r.rows[0].n !== 2) throw new Error(`viewer saw ${r.rows[0].n}`);
  });
  await expectFail(db, "properties: Client Viewer cannot write a property", async () => {
    await db.query(`select public.test_set_user('${viewerId}')`);
    await db.query(`insert into public.properties (agency_id, client_id, name) values ('${agencyA}', '${cidA1}', 'sneaky')`);
  }, "row-level security");

  // Generic per-item detail (e.g. restaurant dishes) with jsonb attributes.
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.niche_items (agency_id, client_id, niche, item_type, name, attributes, sort_order)
    values ('${agencyB}', '${cidB1}', 'restaurant', 'dish', 'Truffle Pasta', '{"orders":214,"trend":22,"intent":"High"}', 1);
  `);
  await expectPass(db, "niche_items: stores typed jsonb attributes, agency-isolated", async () => {
    await db.query("select public.test_set_user('22222222-2222-2222-2222-222222222222')");
    const r = await db.query(`select item_type, (attributes->>'orders')::int as orders from public.niche_items`);
    if (r.rows.length !== 1 || r.rows[0].orders !== 214 || r.rows[0].item_type !== "dish") {
      throw new Error(`got ${JSON.stringify(r.rows)}`);
    }
    // Agency A must not see B's items.
    await db.query("select public.test_set_user('11111111-1111-1111-1111-111111111111')");
    const a = await db.query("select count(*)::int as n from public.niche_items");
    if (a.rows[0].n !== 0) throw new Error(`A leaked ${a.rows[0].n} of B's items`);
  });

  // ------------------------- Phase 7 assertions --------------------------
  // The RPCs the Edge Functions call (onboarding + AI worker queue).
  console.log("\n\x1b[1mPhase 7 — Edge-Function RPCs:\x1b[0m");
  await db.query("select public.test_clear_user()");

  // A brand-new authenticated user provisions their first agency via the RPC.
  const newOwner = "44444444-4444-4444-4444-444444444444";
  await db.exec(`insert into auth.users (id, email) values ('${newOwner}', 'fresh@agency.io');`);

  await expectPass(db, "RPC create_agency_with_owner: provisions agency + owner + counters", async () => {
    await db.query(`select public.test_set_user('${newOwner}')`);
    const r = await db.query(`select id, created_by, current_plan_tier::text from public.create_agency_with_owner('Fresh Agency', 'fresh-agency', 'Berlin')`);
    const agency = r.rows[0];
    if (agency.created_by !== newOwner) throw new Error(`created_by=${agency.created_by}`);
    if (agency.current_plan_tier !== "starter") throw new Error(`tier=${agency.current_plan_tier}`);
    // Owner membership exists…
    const m = await db.query(`select role::text from public.agency_members where agency_id = '${agency.id}' and profile_id = '${newOwner}'`);
    if (m.rows[0]?.role !== "agency_owner") throw new Error("owner membership missing");
    // …and usage_counters was auto-created.
    await db.query("select public.test_clear_user()");
    const u = await db.query(`select team_member_count from public.usage_counters where agency_id = '${agency.id}'`);
    if (u.rows[0]?.team_member_count !== 1) throw new Error(`counters team=${u.rows[0]?.team_member_count}`);
  });

  // The owner can only create an agency owned by themselves (no escalation).
  await expectPass(db, "RPC create_agency_with_owner: created agency is RLS-visible to its owner", async () => {
    await db.query(`select public.test_set_user('${newOwner}')`);
    const r = await db.query("select count(*)::int as n from public.agencies where name = 'Fresh Agency'");
    if (r.rows[0].n !== 1) throw new Error(`owner sees ${r.rows[0].n}`);
  });

  // AI worker queue: claim_ai_job pulls the oldest queued job, then drains.
  await db.query("select public.test_clear_user()");
  await db.exec(`
    insert into public.ai_jobs (agency_id, type, input_ref, created_at)
    values
      ('${agencyA}', 'health_score', '{"n":1}', now() - interval '2 min'),
      ('${agencyA}', 'document_summary', '{"n":2}', now() - interval '1 min');
  `);
  await expectPass(db, "RPC claim_ai_job: claims oldest queued, marks running, then drains to null", async () => {
    const a = (await db.query("select * from public.claim_ai_job()")).rows[0];
    const b = (await db.query("select * from public.claim_ai_job()")).rows[0];
    const c = (await db.query("select * from public.claim_ai_job()")).rows[0];
    if (JSON.stringify(a.input_ref) !== '{"n":1}') throw new Error(`first claim wrong: ${JSON.stringify(a.input_ref)}`);
    if (a.status !== "running" || a.started_at == null) throw new Error("claimed job not marked running");
    if (JSON.stringify(b.input_ref) !== '{"n":2}') throw new Error(`second claim wrong: ${JSON.stringify(b.input_ref)}`);
    if (c && c.id) throw new Error("third claim should be null (queue empty)");
  });

  // complete_ai_job: success path logs ai_usage and rolls credits up.
  await expectPass(db, "RPC complete_ai_job: success logs usage + bumps credits", async () => {
    await db.query("select public.test_clear_user()");
    const before = (await db.query(`select ai_credits_used from public.usage_counters where agency_id = '${agencyA}'`)).rows[0].ai_credits_used;
    const jid = (await db.query(`select id from public.ai_jobs where agency_id = '${agencyA}' and type='health_score' limit 1`)).rows[0].id;
    await db.query(`select public.complete_ai_job('${jid}', 'succeeded', '{"score":86}'::jsonb, null, 'claude-opus-4-8', 1200, 400, 3, 0.02)`);
    const job = (await db.query(`select status::text, finished_at is not null as fin, (output_ref->>'score')::int as score from public.ai_jobs where id = '${jid}'`)).rows[0];
    if (job.status !== "succeeded" || !job.fin || job.score !== 86) throw new Error(`job=${JSON.stringify(job)}`);
    const usage = (await db.query(`select count(*)::int as n from public.ai_usage where job_id = '${jid}'`)).rows[0].n;
    if (usage !== 1) throw new Error(`usage rows = ${usage}`);
    const after = (await db.query(`select ai_credits_used from public.usage_counters where agency_id = '${agencyA}'`)).rows[0].ai_credits_used;
    if (after - before !== 3) throw new Error(`credits delta = ${after - before}`);
  });

  // -----------------------------------------------------------------------
  console.log(
    `\n\x1b[1m${failed === 0 ? "\x1b[32mAll" : "\x1b[31m"} ${passed} passing\x1b[0m${failed ? `, \x1b[31m${failed} failing\x1b[0m` : ""}`
  );
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`  • ${f.name}\n    ${f.err}`);
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
