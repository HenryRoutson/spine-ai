import { randomUUID } from "node:crypto";
import { blankProject } from "../backend/lib/seed.js";
import type { PipelineRun, ProjectId, RunId } from "../backend/lib/types.js";
import { adminClient, ensureUser, signIn } from "./lib/auth.js";
import { openUserStore } from "./lib/supabase_store.js";

// AI : end-to-end proof that user-specific data works with zero user_id plumbing:
// AI :   1. ensure two demo users exist (admin api, pre-confirmed emails)
// AI :   2. each signs in and writes a project + a private doc + a run through SupabaseStore
// AI :   3. fresh sessions verify each user sees ONLY their own rows (store + raw SQL level)

const USERS = [
  { tag: "alice", email: "alice@example.com", password: "demo-pass-alice-1" },
  { tag: "bob", email: "bob@example.com", password: "demo-pass-bob-1" },
];

const PROJECT_ID = "p_blank" as ProjectId;

function fakeRun(): PipelineRun {
  return {
    id: `run_${randomUUID().slice(0, 8)}` as RunId,
    startedAt: Date.now(),
    status: "ok",
    totalMs: 1234,
    billedCents: 3,
    savedCents: 1,
    model: "deepseek-v3",
    steps: [],
  };
}

function check(cond: boolean, label: string): void {
  console.log(`  ${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) process.exitCode = 1;
}

async function main(): Promise<void> {
  const admin = adminClient();
  for (const u of USERS) await ensureUser(admin, u.email, u.password);
  console.log("users ready:", USERS.map((u) => u.email).join(", "), "\n");

  // each user writes their own data through the same Store interface the pipeline uses
  for (const u of USERS) {
    const client = await signIn(u.email, u.password);
    const store = await openUserStore(client);
    if (!store.project(PROJECT_ID)) store.saveProject(blankProject(PROJECT_ID));
    store.addDoc(`${u.tag}_notes.txt`, "text", `secret notes belonging to ${u.tag}`, "inference");
    store.addRun(PROJECT_ID, fakeRun());
    await store.flush();
    console.log(
      `${u.email}: ${store.projects().length} project(s), ${store.docs().length} doc(s), ${store.runs(PROJECT_ID).length} run(s)`,
    );
  }

  // fresh sessions — prove isolation
  console.log("\nisolation checks:");
  const alice = await signIn(USERS[0].email, USERS[0].password);
  const bob = await signIn(USERS[1].email, USERS[1].password);
  const aliceStore = await openUserStore(alice);
  const bobStore = await openUserStore(bob);

  check(aliceStore.docs().length > 0 && bobStore.docs().length > 0, "both users have data");
  check(aliceStore.docs().every((d) => d.name.startsWith("alice")), "alice sees only her docs");
  check(bobStore.docs().every((d) => d.name.startsWith("bob")), "bob sees only his docs");
  check(
    aliceStore.docContent(bobStore.docs()[0].id) === undefined,
    "alice cannot read bob's doc content",
  );

  // belt and braces — an unfiltered query through bob's client still only returns his rows
  const raw = await bob.from("docs").select("name");
  check(
    !raw.error && (raw.data ?? []).every((r) => !(r.name as string).startsWith("alice")),
    "RLS blocks cross-user reads at the SQL level (no filters in the query)",
  );
}

main();
