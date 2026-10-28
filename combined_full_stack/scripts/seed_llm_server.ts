#!/usr/bin/env npx tsx
// AI : OpenAI-compatible seed LLM mock — point OPENROUTER_BASE_URL here for exported pipelines.
import { startSeedLlmServer } from "../lib/server/pipeline_export_parity";

async function main(): Promise<void> {
  const port = Number(process.env.SEED_LLM_PORT ?? "8787");
  const { baseUrl } = await startSeedLlmServer(port);
  console.log(`seed LLM listening at ${baseUrl}`);
  console.log(`export OPENROUTER_BASE_URL=${baseUrl}`);
  console.log(`export OPENROUTER_API_KEY=seed`);
}

void main();
