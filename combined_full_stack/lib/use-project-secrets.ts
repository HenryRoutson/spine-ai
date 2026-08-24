"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { SECRETS_CHANGED_EVENT } from "@/lib/secrets-changed"
import type { PipelineModule, ProjectId } from "@/lib/types"
import {
  collectSecretRequirements,
  type SecretRequirementStatus,
} from "@/lib/webhook-step"

export type SecretRow = {
  name: string
  hint: string
  updatedAt: number
  storedName?: string
}

export type TeamSecretPresence = {
  name: string
  present: true
  source: "team"
}

type SecretsApiResponse = {
  secrets: SecretRow[]
  projectSecrets?: SecretRow[]
  linkedSecretNames?: string[]
  projectPrefix?: string | null
  teamId?: string | null
  teamSecrets?: TeamSecretPresence[]
  teamSecretRows?: SecretRow[]
  canEditTeamSecrets?: boolean
  required?: SecretRequirementStatus[]
}

export function useProjectSecrets(projectId: ProjectId | string | undefined, modules: PipelineModule[]) {
  const declared = useMemo(() => collectSecretRequirements(modules), [modules])
  const [rows, setRows] = useState<SecretRow[]>([])
  const [projectRows, setProjectRows] = useState<SecretRow[]>([])
  const [linkedNames, setLinkedNames] = useState<string[]>([])
  const [projectPrefix, setProjectPrefix] = useState<string | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamPresence, setTeamPresence] = useState<TeamSecretPresence[]>([])
  const [teamRows, setTeamRows] = useState<SecretRow[]>([])
  const [canEditTeam, setCanEditTeam] = useState(false)
  const [required, setRequired] = useState<SecretRequirementStatus[]>([])
  const [loading, setLoading] = useState(!isDemoMode())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (isDemoMode()) {
      setLoading(false)
      return
    }
    setError(null)
    try {
      const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : ""
      const data = await apiJson<SecretsApiResponse>(`${API_ROUTES.secrets}${qs}`)
      setRows(data.secrets ?? [])
      setProjectRows(data.projectSecrets ?? [])
      setLinkedNames(data.linkedSecretNames ?? [])
      setProjectPrefix(data.projectPrefix ?? null)
      setTeamId(data.teamId ?? null)
      setTeamPresence(data.teamSecrets ?? [])
      setTeamRows(data.teamSecretRows ?? [])
      setCanEditTeam(!!data.canEditTeamSecrets)
      setRequired(data.required ?? [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onChange = () => {
      void load()
    }
    window.addEventListener(SECRETS_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(SECRETS_CHANGED_EVENT, onChange)
  }, [load])

  const missing = useMemo(
    () => required.filter((r) => !r.optional && !r.present),
    [required],
  )

  return {
    rows,
    projectRows,
    linkedNames,
    projectPrefix,
    teamId,
    teamPresence,
    teamRows,
    canEditTeam,
    declared,
    required: required.length ? required : declared.map((r) => ({ ...r, present: false })),
    missing,
    hasBlockingMissing: !loading && missing.length > 0,
    loading,
    error,
    reload: load,
    setRows,
    setProjectRows,
    setLinkedNames,
    setTeamPresence,
    setTeamRows,
  }
}
