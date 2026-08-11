// AI : TODO (n8n-stage-B-catalog) — vendor/generate action-node catalog from pinned n8n-nodes-base
// AI :   (and optionally @n8n/nodes-langchain). Source of truth is OSS INodeTypeDescription /
// AI :   dist/types/nodes.json — filter out trigger/webhook/poll groups so only executable
// AI :   action nodes appear in the builder. Expose:
// AI :     listN8nNodes(): { type, displayName, description, credentials, version }[]
// AI :     getN8nNode(type): INodeTypeDescription-lite | undefined
// AI :   Pin n8n package version in package.json / codegen script; regenerate on upgrade.
// AI :   See lib/server/n8n-roadmap.ts.

export {};
