// Generated Spine pipeline connector — gRPC + HTTP JSON on the same contract.
// AI : TODO — persist run + step outputs to Supabase when NEXT_PUBLIC_SUPABASE_URL is set.
// AI : TODO — cache LLM step I/O via PIPELINE_CACHE_URL before invoking runPipeline.
// npm install @grpc/grpc-js @grpc/proto-loader dotenv
import "dotenv/config";
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { createServer } from 'node:http';
import { configurePipelineRuntime, runPipeline } from './example_select_demo_2_1_pipeline';

const PROTO_PATH = new URL('./pipeline_connector.proto', import.meta.url).pathname;
const GRPC_PORT = process.env.PIPELINE_GRPC_PORT ?? '50051';
const HTTP_PORT = process.env.PIPELINE_HTTP_PORT ?? '8080';

configurePipelineRuntime({
  openRouterApiKey: process.env.OPENROUTER_API_KEY,
  openRouterModel: process.env.OPENROUTER_MODEL,
  openRouterSiteUrl: process.env.OPENROUTER_SITE_URL,
  openRouterAppTitle: process.env.OPENROUTER_APP_TITLE,
  sourceText: process.env.PIPELINE_SOURCE_TEXT,
  sourceDocId: process.env.PIPELINE_SOURCE_DOC_ID,
});

async function executeRun(body: Record<string, unknown>): Promise<string> {
  const inputs: Record<string, { content: string; filename: string }> = {};
  for (const slot of body.inputs ?? []) {
    if (slot?.label && slot.document) inputs[slot.label] = slot.document;
  }
  const result = await runPipeline(inputs);
  return JSON.stringify(result, null, 2);
}

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDefinition) as grpc.GrpcObject;
const connector = (proto.forge as grpc.GrpcObject).pipeline as grpc.GrpcObject;

const serviceImpl = {
  RunPipeline: async (
    call: grpc.ServerUnaryCall<Record<string, unknown>, { result_json?: string; error?: string }>,
    cb: grpc.sendUnaryData<{ result_json?: string; error?: string }>,
  ) => {
    try {
  const inputs: Record<string, { content: string; filename: string }> = {};
  for (const slot of call.request.inputs ?? []) {
    if (slot?.label && slot.document) inputs[slot.label] = slot.document;
  }
  const result = await runPipeline(inputs);
      cb(null, { result_json: JSON.stringify(result, null, 2) });
    } catch (e) {
      cb(null, { error: (e as Error).message });
    }
  },
  Health: (_call: grpc.ServerUnaryCall<object, { status: string }>, cb: grpc.sendUnaryData<{ status: string }>) => {
    cb(null, { status: "ok" });
  },
};

const server = new grpc.Server();
server.addService(connector.PipelineConnector.service, serviceImpl);
server.bindAsync(`0.0.0.0:${GRPC_PORT}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
  if (err) throw err;
  server.start();
  console.log(`gRPC PipelineConnector on :${port}`);
});

createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }
  if (req.method === 'POST' && req.url === '/v1/run') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    try {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
      const resultJson = await executeRun(body);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ resultJson }));
    } catch (e) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(Number(HTTP_PORT), () => {
  console.log(`HTTP JSON bridge on :${HTTP_PORT} (POST /v1/run)`);
});
