import { NextResponse, type NextRequest } from "next/server";
import { getStore } from "@/lib/server/app_store";
import type { Project, ProjectId } from "@/lib/server/types";

// AI : persistence for the structure / pipeline / A/B builders — the client sends a
// AI : partial {models | modules | strategies | name} and the store flushes to disk.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = await getStore();
  const project = store.project(id as ProjectId);
  if (!project) return NextResponse.json({ error: `unknown project ${id}` }, { status: 404 });
  const patch = (await req.json()) as Partial<Project>;
  store.saveProject({ ...project, ...patch, id: project.id });
  await store.flush();
  return NextResponse.json({ ok: true });
}
