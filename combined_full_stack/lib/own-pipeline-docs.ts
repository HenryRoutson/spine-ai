import { apiJson, JSON_HEADERS } from "@/lib/api-client"
import { API_ROUTES } from "@/lib/api-routes"
import { confidentialUploadWarning } from "@/lib/confidential-upload"
import { invalidateDocText } from "@/lib/doc-text-cache"
import { DocLabel, type DocRef, type Project } from "@/lib/types"

// AI : run-mode doc upload — link new files to a pipeline without opening the builder shell.
export async function uploadDocForOwnPipeline(file: File, project: Project): Promise<DocRef> {
  const blocked = confidentialUploadWarning(file.name)
  if (blocked) throw new Error(blocked)

  const form = new FormData()
  form.append("file", file)
  form.append("label", DocLabel.Inference)
  form.append("projectId", project.id)
  const doc = await apiJson<DocRef>(API_ROUTES.docs, { method: "POST", body: form })
  invalidateDocText(doc.id)

  if (!project.seedDocNames?.includes(doc.name)) {
    const nextProject: Project = {
      ...project,
      seedDocNames: [...(project.seedDocNames ?? []), doc.name],
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
  }

  return doc
}
