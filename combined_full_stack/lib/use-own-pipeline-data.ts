"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { docsForProject } from "@/lib/project-docs"
import {
  readAccountStateCache,
  readProjectRunsCache,
  writeProjectRunsCache,
} from "@/lib/project-state-cache"
import { migrateProjectModules } from "@/lib/quote-steps"
import { readStateStream } from "@/lib/state-stream"
import { API_ROUTES } from "@/lib/api-routes"
import { useOptionalStore } from "@/lib/store"
import type { DocRef, PipelineRun, Project, ProjectId } from "@/lib/types"

export function useOwnPipelineData(projectId: ProjectId) {
  const builder = useOptionalStore()
  const isBuilderActive = builder?.project.id === projectId

  const [loading, setLoading] = useState(!isBuilderActive)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [localProject, setLocalProject] = useState<Project | null>(null)
  const [localDocs, setLocalDocs] = useState<DocRef[]>([])
  const [localRuns, setLocalRuns] = useState<PipelineRun[]>([])

  const project = isBuilderActive ? builder!.project : localProject
  const docs = isBuilderActive ? builder!.docs : localDocs
  const runs = isBuilderActive ? builder!.runs : localRuns

  const modules = useMemo(
    () => (project ? migrateProjectModules(project).modules : []),
    [project],
  )

  const models = useMemo(
    () => (project ? migrateProjectModules(project).models : []),
    [project],
  )

  useEffect(() => {
    if (isBuilderActive) {
      setLoading(false)
      setLoadError(null)
      return
    }

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    async function load() {
      const account = readAccountStateCache()
      const cachedProject = account?.projects.find((p) => p.id === projectId)
      const cachedRuns = readProjectRunsCache(projectId)

      if (cachedProject && cachedRuns) {
        const migrated = migrateProjectModules(cachedProject)
        const projectDocs = account ? docsForProject(account.docs, migrated) : []
        if (!cancelled) {
          setLocalProject(migrated)
          setLocalDocs(projectDocs)
          setLocalRuns(cachedRuns.runs)
          setLoading(false)
        }
        return
      }

      try {
        const stream = await readStateStream(
          `${API_ROUTES.state}?projectId=${encodeURIComponent(projectId)}`,
        )
        const loadedProject = stream.projects?.find((p) => p.id === projectId)
        if (!loadedProject) throw new Error("Pipeline not found")
        const migrated = migrateProjectModules(loadedProject)
        const projectRuns = stream.runs ?? []
        writeProjectRunsCache(projectId, projectRuns)
        if (!cancelled) {
          setLocalProject(migrated)
          setLocalDocs(stream.docs ?? [])
          setLocalRuns(projectRuns)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message)
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId, isBuilderActive])

  const patchLocalProject = useCallback((next: Project) => {
    setLocalProject(next)
  }, [])

  const patchLocalDocs = useCallback((next: DocRef[]) => {
    setLocalDocs(next)
  }, [])

  const patchLocalRuns = useCallback((next: PipelineRun[]) => {
    setLocalRuns(next)
    writeProjectRunsCache(projectId, next)
  }, [projectId])

  return {
    loading,
    loadError,
    isBuilderActive,
    builder,
    project,
    docs,
    runs,
    modules,
    models,
    patchLocalProject,
    patchLocalDocs,
    patchLocalRuns,
  }
}
