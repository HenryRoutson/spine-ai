#!/usr/bin/env node
// AI : compare HTTP/1.1 burst vs pooled vs HTTP/2 multiplex for N parallel OpenRouter calls.
// AI : pinned to deepseek/deepseek-chat — rejects router/auto slugs and verifies response.model.
import { config } from "dotenv";
import http2 from "node:http2";
import { Agent, fetch as undiciFetch } from "undici";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
config({ path: join(appRoot, ".env.local") });
config({ path: join(appRoot, "../.env") });

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_ORIGIN = "https://openrouter.ai";
const MODEL = "deepseek/deepseek-chat";

const key = process.env.OPENROUTER_API_KEY?.trim();
if (!key) {
  console.error("OPENROUTER_API_KEY missing — set a regular inference key in the repo root .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const nArg = args.find((a) => a.startsWith("--n="));
const N = nArg ? Math.max(1, Number(nArg.slice(4))) : 100;
const poolArg = args.find((a) => a.startsWith("--pool="));
const POOL = poolArg ? Math.max(1, Number(poolArg.slice(7))) : 8;

function headers() {
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
    "X-Title": process.env.OPENROUTER_APP_TITLE ?? "forge",
  };
}

function requestBody(index) {
  return JSON.stringify({
    model: MODEL,
    messages: [{ role: "user", content: `Reply with exactly the number: ${index}` }],
    max_tokens: 8,
    temperature: 0,
    // AI : block routing to a different model family — still allows DeepInfra/StreamLake DeepSeek hosts.
    provider: { allow_fallbacks: false },
  });
}

function assertDeepseek(responseModel) {
  const got = String(responseModel ?? "").toLowerCase();
  if (!got.startsWith("deepseek/")) {
    throw new Error(`model mismatch: requested ${MODEL}, got ${responseModel}`);
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

function summarize(label, latencies, errors, modelMismatches, wallMs) {
  const ok = latencies.length;
  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    strategy: label,
    wallMs,
    ok,
    failed: errors,
    modelMismatches,
    p50Ms: pct(sorted, 50),
    p95Ms: pct(sorted, 95),
    maxMs: sorted.at(-1) ?? 0,
  };
}

async function parseChat(res, t0) {
  const latencyMs = Date.now() - t0;
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  assertDeepseek(data.model);
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("no message content");
  return { latencyMs, content: content.trim() };
}

async function runHttp1Burst() {
  const latencies = [];
  let errors = 0;
  let modelMismatches = 0;
  const t0 = Date.now();
  const results = await Promise.allSettled(
    Array.from({ length: N }, async (_, i) => {
      const start = Date.now();
      const res = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: headers(),
        body: requestBody(i),
      });
      return parseChat(res, start);
    }),
  );
  for (const r of results) {
    if (r.status === "fulfilled") latencies.push(r.value.latencyMs);
    else {
      errors++;
      if (String(r.reason?.message ?? r.reason).includes("model mismatch")) modelMismatches++;
    }
  }
  return summarize("http1-burst (N parallel fetch)", latencies, errors, modelMismatches, Date.now() - t0);
}

async function runHttp1Pooled() {
  const agent = new Agent({ connections: POOL, pipelining: 1 });
  const latencies = [];
  let errors = 0;
  let modelMismatches = 0;
  const t0 = Date.now();
  try {
    const results = await Promise.allSettled(
      Array.from({ length: N }, async (_, i) => {
        const start = Date.now();
        const res = await undiciFetch(OPENROUTER_URL, {
          method: "POST",
          headers: headers(),
          body: requestBody(i),
          dispatcher: agent,
        });
        return parseChat(res, start);
      }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") latencies.push(r.value.latencyMs);
      else {
        errors++;
        if (String(r.reason?.message ?? r.reason).includes("model mismatch")) modelMismatches++;
      }
    }
  } finally {
    await agent.close();
  }
  return summarize(`http1-pooled (${POOL} connections)`, latencies, errors, modelMismatches, Date.now() - t0);
}

function h2Chat(session, index) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    const req = session.request({
      ":method": "POST",
      ":path": "/api/v1/chat/completions",
      authorization: headers().Authorization,
      "content-type": "application/json",
      "http-referer": headers()["HTTP-Referer"],
      "x-title": headers()["X-Title"],
    });
    let raw = "";
    let status = 0;
    req.on("response", (h) => {
      status = h[":status"];
    });
    req.on("data", (c) => (raw += c));
    req.on("error", reject);
    req.on("end", () => {
      const latencyMs = Date.now() - t0;
      if (status !== 200) {
        reject(new Error(`HTTP ${status}: ${raw.slice(0, 200)}`));
        return;
      }
      try {
        const data = JSON.parse(raw);
        assertDeepseek(data.model);
        resolve(latencyMs);
      } catch (e) {
        reject(e);
      }
    });
    req.end(requestBody(index));
  });
}

async function runHttp2Multiplex() {
  const latencies = [];
  let errors = 0;
  let modelMismatches = 0;
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const session = http2.connect(OPENROUTER_ORIGIN);
    session.on("error", reject);
    Promise.allSettled(Array.from({ length: N }, (_, i) => h2Chat(session, i)))
      .then((results) => {
        for (const r of results) {
          if (r.status === "fulfilled") latencies.push(r.value);
          else {
            errors++;
            if (String(r.reason?.message ?? r.reason).includes("model mismatch")) modelMismatches++;
          }
        }
        session.close();
        resolve();
      })
      .catch((e) => {
        session.close();
        reject(e);
      });
  });
  return summarize("http2-multiplex (1 connection)", latencies, errors, modelMismatches, Date.now() - t0);
}

function printRow(r) {
  console.log(
    [
      r.strategy.padEnd(32),
      `wall=${String(r.wallMs).padStart(6)}ms`,
      `ok=${String(r.ok).padStart(3)}/${N}`,
      `p50=${String(r.p50Ms).padStart(5)}ms`,
      `p95=${String(r.p95Ms).padStart(5)}ms`,
      `max=${String(r.maxMs).padStart(5)}ms`,
      r.failed ? `fail=${r.failed}` : "",
      r.modelMismatches ? `model≠=${r.modelMismatches}` : "",
    ]
      .filter(Boolean)
      .join("  "),
  );
}

console.log(`OpenRouter parallel benchmark — model=${MODEL}  N=${N}  pool=${POOL}\n`);

const rows = [];
for (const run of [runHttp1Burst, runHttp1Pooled, runHttp2Multiplex]) {
  process.stdout.write(`running ${run.name}… `);
  const row = await run();
  rows.push(row);
  console.log("done");
  printRow(row);
  console.log();
}

rows.sort((a, b) => a.wallMs - b.wallMs);
console.log("fastest wall-clock:", rows[0].strategy, `(${rows[0].wallMs}ms)`);
