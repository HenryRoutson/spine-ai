# Generated Spine pipeline connector — gRPC + HTTP JSON on the same contract.
# AI : TODO — persist run + step outputs to Supabase when NEXT_PUBLIC_SUPABASE_URL is set.
# AI : TODO — cache LLM step I/O via PIPELINE_CACHE_URL before invoking run_pipeline.
# pip install grpcio grpcio-tools python-dotenv httpx
from __future__ import annotations

import asyncio
import json
import os
from concurrent import futures

import grpc
from dotenv import load_dotenv

load_dotenv()

# After: python -m grpc_tools.protoc -I. --python_out=. --grpc_python_out=. pipeline_connector.proto
import pipeline_connector_pb2
import pipeline_connector_pb2_grpc

from example_select_demo_2_1_pipeline import configure_pipeline_runtime, run_pipeline

GRPC_PORT = os.environ.get("PIPELINE_GRPC_PORT", "50051")
HTTP_PORT = int(os.environ.get("PIPELINE_HTTP_PORT", "8080"))

configure_pipeline_runtime(
    open_router_api_key=os.environ.get('OPENROUTER_API_KEY'),
    open_router_model=os.environ.get('OPENROUTER_MODEL'),
    open_router_site_url=os.environ.get('OPENROUTER_SITE_URL'),
    open_router_app_title=os.environ.get('OPENROUTER_APP_TITLE'),
    source_text=os.environ.get('PIPELINE_SOURCE_TEXT'),
    source_doc_id=os.environ.get('PIPELINE_SOURCE_DOC_ID'),
)


async def execute_run(body: dict) -> str:
    inputs = {
        slot['label']: slot['document']
        for slot in (body.get('inputs') or [])
        if slot.get('label') and slot.get('document')
    }
    result = await run_pipeline(inputs)
    return json.dumps(result, indent=2)


class PipelineConnectorServicer(pipeline_connector_pb2_grpc.PipelineConnectorServicer):
    async def RunPipeline(self, request, context):
        try:
            inputs = {
                slot.label: {'content': slot.document.content, 'filename': slot.document.filename}
                for slot in request.inputs
                if slot.label and slot.document
            }
            result = await run_pipeline(inputs)
            return pipeline_connector_pb2.RunPipelineResponse(result_json=json.dumps(result, indent=2))
        except Exception as e:
            return pipeline_connector_pb2.RunPipelineResponse(error=str(e))

    async def Health(self, request, context):
        return pipeline_connector_pb2.HealthResponse(status="ok")


async def handle_http(reader, writer):
    data = await reader.read(10_000_000)
    line = data.decode('utf8', errors='replace').split('\r\n', 1)[0]
    headers_raw, _, body_raw = data.decode('utf8', errors='replace').partition('\r\n\r\n')
    first = headers_raw.split('\r\n')[0]
    if first.startswith('GET /health'):
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\n\r\n{\"status\":\"ok\"}")
        await writer.drain()
        writer.close()
        return
    if first.startswith('POST /v1/run'):
        try:
            body = json.loads(body_raw or '{}')
            result_json = await execute_run(body)
            payload = json.dumps({"resultJson": result_json}).encode()
            writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: " + str(len(payload)).encode() + b"\r\n\r\n" + payload)
        except Exception as e:
            payload = json.dumps({"error": str(e)}).encode()
            writer.write(b"HTTP/1.1 500 Internal Server Error\r\nContent-Type: application/json\r\nContent-Length: " + str(len(payload)).encode() + b"\r\n\r\n" + payload)
        await writer.drain()
        writer.close()
        return
    writer.write(b'HTTP/1.1 404 Not Found\r\n\r\n')
    await writer.drain()
    writer.close()


async def main() -> None:
    server = grpc.aio.server()
    pipeline_connector_pb2_grpc.add_PipelineConnectorServicer_to_server(PipelineConnectorServicer(), server)
    server.add_insecure_port(f'[::]:{GRPC_PORT}')
    await server.start()
    print(f"gRPC PipelineConnector on :{GRPC_PORT}")

    http_server = await asyncio.start_server(handle_http, '0.0.0.0', HTTP_PORT)
    print(f"HTTP JSON bridge on :{HTTP_PORT} (POST /v1/run)")
    async with http_server:
        await http_server.serve_forever()


if __name__ == "__main__":
    asyncio.run(main())
