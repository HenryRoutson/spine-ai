import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { invalidateDocText } from "@/lib/doc-text-cache"
import { DocLabel, type DocId, type DocRef, type InputType, type Project } from "@/lib/types"

// AI : ensure new inference docs appear in the pipeline seed list (share/run shell has no StoreProvider).
async function linkSeedDocName(project: Project, docName: string): Promise<Project> {
  if (project.seedDocNames?.includes(docName)) return project
  const nextProject: Project = {
    ...project,
    seedDocNames: [...(project.seedDocNames ?? []), docName],
  }
  await apiJson(API_ROUTES.project(project.id), {
    method: "PUT",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name: nextProject.name,
      kind: nextProject.kind,
      models: nextProject.models,
      typeAliases: nextProject.typeAliases,
      modules: nextProject.modules,
      strategies: nextProject.strategies,
      seedDocNames: nextProject.seedDocNames,
      expectedOutputs: nextProject.expectedOutputs,
      inferencePresets: nextProject.inferencePresets,
      llmProviders: nextProject.llmProviders,
      documentation: nextProject.documentation,
    }),
  })
  return nextProject
}

// AI : run-mode doc upload — link new files to a pipeline without opening the builder shell.
export async function uploadDocForOwnPipeline(
  file: File,
  project: Project,
): Promise<{ doc: DocRef; project: Project }> {
  const blocked = confidentialUploadWarning(file.name)
  if (blocked) throw new Error(blocked)
  if (project.teamReadOnly) throw new Error("This team project is read-only for your role.")

  const form = new FormData()
  form.append("file", file)
  form.append("label", DocLabel.Inference)
  form.append("projectId", project.id)
  const doc = await apiJson<DocRef>(API_ROUTES.docs, { method: "POST", body: form })
  invalidateDocText(doc.id)
  const nextProject = await linkSeedDocName(project, doc.name)
  return { doc, project: nextProject }
}

// AI : JSON struct empty/branch apply — same content endpoint as builder addDocContent.
export async function uploadDocContentForOwnPipeline(
  name: string,
  type: InputType,
  content: string,
  project: Project,
  replaceDocId?: DocId,
): Promise<{ doc: DocRef; project: Project }> {
  const blocked = confidentialUploadWarning(name)
  if (blocked) throw new Error(blocked)
  if (project.teamReadOnly) throw new Error("This team project is read-only for your role.")

  const doc = await apiJson<DocRef>(API_ROUTES.docsContent, {
    method: "POST",
    headers: JSON_HEADERS,
    body: JSON.stringify({
      name,
      type,
      content,
      label: DocLabel.Inference,
      projectId: project.id,
      replaceDocId,
    }),
  })
  if (replaceDocId) invalidateDocText(replaceDocId)
  invalidateDocText(doc.id)
  const nextProject = await linkSeedDocName(project, doc.name)
  return { doc, project: nextProject }
}
