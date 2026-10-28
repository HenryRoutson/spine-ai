"use client"

// AI : Library → Secrets — project-prefixed, personal (link like files), team (no value visibility).
import { useMemo, useState } from "react"
import { Eye, EyeOff, KeyRound, Link2, Loader2, Plus, Trash2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { isDemoMode } from "@/lib/demo-mode"
import { notifySecretsChanged } from "@/lib/secrets-changed"
import type { SecretScope } from "@/lib/secret-scope"
import { useStore } from "@/lib/store"
import { useProjectSecrets, type SecretRow } from "@/lib/use-project-secrets"
import { groupSecretRequirements, WEBHOOK_URL_DEFAULTS } from "@/lib/webhook-step"
import { EnvSecretsImport } from "@/components/env-secrets-import"

const PRESETS: { name: string; blurb: string }[] = [
  {
    name: "HIGGSFIELD_API_KEY",
    blurb: "Higgsfield Authorization — paste `Key KEY_ID:KEY_SECRET` or `KEY_ID:KEY_SECRET`.",
  },
  {
    name: "HIGGSFIELD_GENERATE_URL",
    blurb: `Optional video endpoint override. Default: ${WEBHOOK_URL_DEFAULTS.HIGGSFIELD_GENERATE_URL}`,
  },
  {
    name: "HIGGSFIELD_IMAGE_URL",
    blurb: `Optional image endpoint override. Default: ${WEBHOOK_URL_DEFAULTS.HIGGSFIELD_IMAGE_URL}`,
  },
]

function upsertRow(prev: SecretRow[], row: SecretRow): SecretRow[] {
  return [...prev.filter((r) => r.name !== row.name), row].sort((a, b) => a.name.localeCompare(b.name))
}

export function SecretsSettings() {
  const { project, modules, patchProject } = useStore()
  const {
    rows,
    projectRows,
    linkedNames,
    projectPrefix,
    teamId,
    teamPresence,
    teamRows,
    canEditTeam,
    required,
    missing,
    loading,
    error,
    reload,
    setRows,
    setProjectRows,
    setLinkedNames,
    setTeamPresence,
    setTeamRows,
  } = useProjectSecrets(project.id, modules)

  const [scope, setScope] = useState<SecretScope>("project")
  const [draftName, setDraftName] = useState("HIGGSFIELD_API_KEY")
  const [draftValue, setDraftValue] = useState("")
  const [showValue, setShowValue] = useState(false)
  const [saving, setSaving] = useState(false)
  const [busyName, setBusyName] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const requiredGroups = useMemo(() => groupSecretRequirements(required), [required])
  const byPersonal = useMemo(() => new Map(rows.map((r) => [r.name, r])), [rows])
  const byProject = useMemo(() => new Map(projectRows.map((r) => [r.name, r])), [projectRows])
  const linkedSet = useMemo(() => new Set(linkedNames), [linkedNames])
  const teamPresent = useMemo(() => new Set(teamPresence.map((t) => t.name)), [teamPresence])
  const storedNamePreview =
    scope === "project" && projectPrefix
      ? `${projectPrefix}_${draftName.trim() || "NAME"}`
      : draftName.trim() || "NAME"
  const displayError = actionError ?? error

  async function saveSecret() {
    const name = draftName.trim()
    const value = draftValue.trim()
    if (!name || !value) return
    setSaving(true)
    setActionError(null)
    try {
      const data = await apiJson<{ secret: SecretRow; scope: SecretScope }>(API_ROUTES.secrets, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          value,
          scope,
          projectId: project.id,
          teamId: teamId ?? undefined,
          linkToProject: scope === "personal",
        }),
      })
      if (data.scope === "project") setProjectRows((prev) => upsertRow(prev, data.secret))
      else if (data.scope === "personal") {
        setRows((prev) => upsertRow(prev, data.secret))
        const nextLinked = [...new Set([...linkedNames, data.secret.name])].sort()
        setLinkedNames(nextLinked)
        patchProject({ seedSecretNames: nextLinked })
      } else if (canEditTeam) {
        setTeamRows((prev) => upsertRow(prev, data.secret))
        setTeamPresence((prev) =>
          prev.some((p) => p.name === data.secret.name)
            ? prev
            : [...prev, { name: data.secret.name, present: true as const, source: "team" as const }],
        )
      }
      setDraftValue("")
      notifySecretsChanged()
      void reload()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function removeSecret(name: string, from: SecretScope) {
    setBusyName(name)
    setActionError(null)
    try {
      const qs = new URLSearchParams({ name, scope: from })
      if (from !== "team") qs.set("projectId", project.id)
      if (from === "team" && teamId) qs.set("teamId", teamId)
      await apiJson<{ ok: true }>(`${API_ROUTES.secrets}?${qs}`, { method: "DELETE" })
      if (from === "project") setProjectRows((prev) => prev.filter((r) => r.name !== name))
      if (from === "personal") {
        setRows((prev) => prev.filter((r) => r.name !== name))
        const nextLinked = linkedNames.filter((n) => n !== name)
        setLinkedNames(nextLinked)
        patchProject({ seedSecretNames: nextLinked })
      }
      if (from === "team") {
        setTeamRows((prev) => prev.filter((r) => r.name !== name))
        setTeamPresence((prev) => prev.filter((p) => p.name !== name))
      }
      notifySecretsChanged()
      void reload()
    } catch (err) {
      setActionError((err as Error).message)
    } finally {
      setBusyName(null)
    }
  }

  async function toggleLink(name: string, link: boolean) {
    const next = link
      ? [...new Set([...linkedNames, name])].sort()
      : linkedNames.filter((n) => n !== name)
    setActionError(null)
    try {
      await apiJson<{ linkedSecretNames: string[] }>(API_ROUTES.secrets, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, linkedSecretNames: next }),
      })
      setLinkedNames(next)
      patchProject({ seedSecretNames: next })
      notifySecretsChanged()
    } catch (err) {
      setActionError((err as Error).message)
    }
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <section className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <KeyRound className="h-3.5 w-3.5" />
              Secrets
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Project keys store as <span className="font-mono">{projectPrefix ?? "PROJECT"}</span>_NAME.
              Personal keys live outside the project and link in like files. Team keys resolve at run time —
              members never see values.
            </p>
          </div>
          <div className="space-y-4 px-4 py-3">
            {isDemoMode() ? (
              <p className="font-mono text-[11px] text-muted-foreground">Secrets are disabled in demo mode.</p>
            ) : loading ? (
              <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading secrets
              </div>
            ) : (
              <>
                {missing.length > 0 ? (
                  <p className="font-mono text-[11px] text-destructive">
                    Missing required {missing.length === 1 ? "secret" : "secrets"} — add{" "}
                    {[...new Set(missing.map((m) => m.name))].join(", ")} before running inference.
                  </p>
                ) : null}

                <EnvSecretsImport
                  projectId={project.id}
                  teamId={teamId}
                  canEditTeam={canEditTeam}
                  projectPrefix={projectPrefix}
                  onImported={() => void reload()}
                />

                {requiredGroups.map((group) => {
                  const fromProject = byProject.get(group.name)
                  const fromPersonal = byPersonal.get(group.name)
                  const fromTeam = teamPresent.has(group.name)
                  const present = required.some((r) => r.name === group.name && r.present)
                  const missingThis = !group.optional && !present
                  const preset = PRESETS.find((p) => p.name === group.name)
                  return (
                    <div
                      key={group.name}
                      className={`rounded-md border px-3 py-2.5 ${missingThis ? "border-destructive/50 bg-destructive/5" : "border-border"}`}
                    >
                      <p className="font-mono text-xs font-medium">{group.name}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {group.optional ? "Optional" : "Required"} for {group.steps.join(", ")}
                        {preset ? ` — ${preset.blurb}` : ""}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                        {fromProject
                          ? `project · …${fromProject.hint}`
                          : fromPersonal && linkedSet.has(group.name)
                            ? `personal (linked) · …${fromPersonal.hint}`
                            : fromTeam
                              ? "team · set (value hidden)"
                              : present
                                ? "environment"
                                : group.optional
                                  ? "not set — using default"
                                  : "not set"}
                      </p>
                    </div>
                  )
                })}

                <div className="space-y-2">
                  <p className="text-[11px] font-medium text-muted-foreground">Save as</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["project", "This project"],
                        ["personal", "Personal (link)"],
                        ["team", "Team"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        disabled={id === "team" && (!teamId || !canEditTeam)}
                        onClick={() => setScope(id)}
                        className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          scope === id
                            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {scope === "project" ? (
                    <p className="font-mono text-[10px] text-muted-foreground">Stores as {storedNamePreview}</p>
                  ) : null}
                </div>

                <form
                  className="space-y-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void saveSecret()
                  }}
                >
                  <Input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value.toUpperCase())}
                    placeholder="SECRET_NAME"
                    className="h-8 font-mono text-xs"
                    autoComplete="off"
                  />
                  <div className="flex gap-2">
                    <div className="relative min-w-0 flex-1">
                      <Input
                        type={showValue ? "text" : "password"}
                        value={draftValue}
                        onChange={(e) => setDraftValue(e.target.value)}
                        placeholder="Value — shown only while typing"
                        className="h-8 pr-9 font-mono text-xs"
                        autoComplete="off"
                        disabled={scope === "team" && !canEditTeam}
                      />
                      <button
                        type="button"
                        className="absolute right-2 top-1.5 text-muted-foreground"
                        onClick={() => setShowValue((v) => !v)}
                        aria-label={showValue ? "Hide value" : "Show value"}
                      >
                        {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={
                        saving ||
                        !draftName.trim() ||
                        !draftValue.trim() ||
                        (scope === "team" && (!teamId || !canEditTeam))
                      }
                    >
                      {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                </form>

                {projectRows.length > 0 ? (
                  <SecretList
                    title={`Project · ${projectPrefix ?? "PROJECT"}_*`}
                    rows={projectRows}
                    busyName={busyName}
                    onRemove={(n) => void removeSecret(n, "project")}
                  />
                ) : null}

                <div className="space-y-2">
                  <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                    <Link2 className="h-3 w-3" />
                    Personal (linked like files)
                  </p>
                  {rows.length === 0 ? (
                    <p className="font-mono text-[11px] text-muted-foreground">No personal secrets yet.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {rows.map((row) => {
                        const linked = linkedSet.has(row.name)
                        return (
                          <li
                            key={row.name}
                            className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]"
                          >
                            <span>
                              {row.name} · …{row.hint}
                              {linked ? " · linked" : ""}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => void toggleLink(row.name, !linked)}
                              >
                                {linked ? "Unlink" : "Link"}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busyName === row.name}
                                onClick={() => void removeSecret(row.name, "personal")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {teamId ? (
                  <div className="space-y-2">
                    <p className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      <Users className="h-3 w-3" />
                      Team
                    </p>
                    {teamPresence.length === 0 && teamRows.length === 0 ? (
                      <p className="font-mono text-[11px] text-muted-foreground">No team secrets yet.</p>
                    ) : canEditTeam ? (
                      <SecretList
                        title="Team secrets"
                        rows={teamRows}
                        busyName={busyName}
                        onRemove={(n) => void removeSecret(n, "team")}
                      />
                    ) : (
                      <ul className="divide-y divide-border rounded-md border border-border">
                        {teamPresence.map((p) => (
                          <li key={p.name} className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                            {p.name} · set (value hidden)
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </>
            )}
            {displayError ? <p className="font-mono text-[11px] text-destructive">{displayError}</p> : null}
          </div>
        </section>
      </div>
    </div>
  )
}

function SecretList({
  title,
  rows,
  busyName,
  onRemove,
}: {
  title: string
  rows: SecretRow[]
  busyName: string | null
  onRemove: (name: string) => void
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium text-muted-foreground">{title}</p>
      <ul className="divide-y divide-border rounded-md border border-border">
        {rows.map((row) => (
          <li key={row.name} className="flex items-center justify-between gap-2 px-3 py-2 font-mono text-[11px]">
            <span>
              {row.name} · …{row.hint}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busyName === row.name}
              onClick={() => onRemove(row.name)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
