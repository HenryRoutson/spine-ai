// AI : fork all three dev servers — one command, shared Ctrl+C shutdown.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;

function start(label, command, args, cwd = root) {
  const child = spawn(command, args, { cwd, stdio: "inherit", env: process.env });
  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    if (signal) shutdown(0);
    else shutdown(code ?? 1);
  });
  children.push(child);
  console.log(`[${label}] started`);
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 100);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

start("api", "node", ["server/index.js"]);
start("app", "npm", ["run", "dev"], path.join(root, "application_react"));
start("dashboard", "npm", ["run", "dev"], path.join(root, "recreate_application_activity"));

console.log("\n→ http://localhost:5180");
console.log("  app       http://localhost:5180/app/");
console.log("  dashboard http://localhost:5180/dashboard/\n");
