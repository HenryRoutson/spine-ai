"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, Copy, Loader2, UserMinus, UserPlus, Users } from "lucide-react"
import { API_ROUTES } from "@/lib/api-routes"
import { apiJson } from "@/lib/api-client"
import { readActiveTeamId, writeActiveTeamId } from "@/lib/active-team-session"
import { readTeamsSnapshot } from "@/lib/teams-snapshot-cache"
import { fetchTeams } from "@/lib/warm-settings-data"
import { useOptionalStore } from "@/lib/store"
import type { TeamView, team_id_string, team_invite_token_string } from "@/lib/team-types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { TeamSettingsSkeleton } from "@/components/account-panel-skeletons"
import { isDemoMode } from "@/lib/demo-mode"

export function TeamSettings() {
  const store = useOptionalStore()
  const project = store?.project
  const [teams, setTeams] = useState<TeamView[]>(() => readTeamsSnapshot() ?? [])
  const [activeTeamId, setActiveTeamId] = useState<team_id_string | null>(null)
  const [loading, setLoading] = useState(() => readTeamsSnapshot() == null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newTeamName, setNewTeamName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteToken, setInviteToken] = useState("")
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const cached = readTeamsSnapshot()
    if (cached) setTeams(cached)
    setLoading(!cached)
    setError(null)
    try {
      const next = await fetchTeams()
      setTeams(next)
      const stored = readActiveTeamId()
      if (stored && next.some((t) => t.id === stored)) setActiveTeamId(stored)
      else if (next.length === 1) setActiveTeamId(next[0]!.id)
    } catch (err) {
      if (!cached) setError(err instanceof Error ? err.message : "Failed to load teams")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (typeof window === "undefined") return
    const token = new URLSearchParams(window.location.search).get("teamInvite")
    if (token) setInviteToken(token)
  }, [])

  useEffect(() => {
    writeActiveTeamId(activeTeamId)
  }, [activeTeamId])

  const activeTeam = teams.find((t) => t.id === activeTeamId) ?? null
  const canManage = activeTeam?.role === "owner" || activeTeam?.role === "admin"
  const projectSharedWithTeam = activeTeam && project && project.teamId === activeTeam.id

  async function createTeam() {
    if (!newTeamName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ team: TeamView }>(API_ROUTES.teams, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTeamName.trim() }),
      })
      setTeams((prev) => [...prev, body.team])
      setActiveTeamId(body.team.id)
      setNewTeamName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team")
    } finally {
      setBusy(false)
    }
  }

  async function inviteMember() {
    if (!activeTeam || !inviteEmail.trim()) return
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ invite: { token: team_invite_token_string } }>(
        API_ROUTES.teamInvite(activeTeam.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: inviteEmail.trim(), role: "member" }),
        },
      )
      setInviteEmail("")
      setCopiedToken(body.invite.token)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send invite")
    } finally {
      setBusy(false)
    }
  }

  async function acceptInvite() {
    if (!inviteToken.trim()) return
    setBusy(true)
    setError(null)
    try {
      const body = await apiJson<{ team: TeamView }>(API_ROUTES.teamInvitesAccept, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: inviteToken.trim() }),
      })
      setInviteToken("")
      setActiveTeamId(body.team.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept invite")
    } finally {
      setBusy(false)
    }
  }

  async function removeMember(userId: string) {
    if (!activeTeam) return
    setBusy(true)
    setError(null)
    try {
      await apiJson(API_ROUTES.teamMember(activeTeam.id, userId), { method: "DELETE" })
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member")
    } finally {
      setBusy(false)
    }
  }

  async function toggleProjectSharing() {
    if (!activeTeam || !project || project.teamReadOnly) return
    setBusy(true)
    setError(null)
    const nextTeamId = projectSharedWithTeam ? null : activeTeam.id
    try {
      await apiJson(API_ROUTES.projectTeam(project.id), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId: nextTeamId }),
      })
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project sharing")
    } finally {
      setBusy(false)
    }
  }

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/settings?teamInvite=${encodeURIComponent(token)}`
    void navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  if (isDemoMode()) {
    return (
      <section className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Team</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Enterprise workspaces are disabled in demo preview.</p>
        </div>
      </section>
    )
  }

  return (
    <section id="settings-team" className="rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          Team
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shared workspaces — members view team projects; runs bill the team owner&apos;s credit pool.
        </p>
      </div>

      <div className="flex flex-col gap-4 px-4 py-3">
        {error && <p className="text-xs text-destructive">{error}</p>}
        {loading ? (
          <TeamSettingsSkeleton />
        ) : (
          <>
            {teams.length > 0 && (
              <div className="flex flex-col gap-1">
                <p className="font-mono text-[10px] uppercase text-muted-foreground">active team</p>
                {teams.map((team) => {
                  const active = team.id === activeTeamId
                  return (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setActiveTeamId(team.id)}
                      className={cn(
                        "flex items-center justify-between rounded-md px-3 py-2 text-left text-xs transition-colors",
                        active ? "bg-secondary" : "hover:bg-secondary/50",
                      )}
                    >
                      <span>
                        <span className="block font-medium">{team.name}</span>
                        <span className="text-muted-foreground">
                          {team.members.length} member{team.members.length === 1 ? "" : "s"} · {team.role}
                        </span>
                      </span>
                      {active && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  )
                })}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                placeholder="New team name"
                className="h-8 text-xs"
              />
              <Button size="sm" disabled={busy || !newTeamName.trim()} onClick={() => void createTeam()}>
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Create"}
              </Button>
            </div>

            {activeTeam && (
              <>
                <div className="rounded-md border border-border/60 p-3">
                  <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">members</p>
                  <ul className="flex flex-col gap-1.5">
                    {activeTeam.members.map((m) => (
                      <li key={m.userId} className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate">
                          <span className="font-medium">{m.email ?? m.userId.slice(0, 8)}</span>
                          <span className="ml-2 text-muted-foreground">{m.role}</span>
                        </span>
                        {canManage && m.role !== "owner" && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            disabled={busy}
                            onClick={() => void removeMember(m.userId)}
                            aria-label="Remove member"
                            spineId="settings.remove-member"
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {canManage && (
                  <div className="flex gap-2">
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Invite by email"
                      type="email"
                      className="h-8 text-xs"
                    />
                    <Button size="sm" disabled={busy || !inviteEmail.trim()} onClick={() => void inviteMember()} spineId="settings.invite-member">
                      <UserPlus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                {canManage && activeTeam.pendingInvites.length > 0 && (
                  <div className="rounded-md border border-dashed border-border/60 p-3">
                    <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">pending invites</p>
                    {activeTeam.pendingInvites.map((inv) => (
                      <div key={inv.token} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-muted-foreground">{inv.email}</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-[10px]"
                          onClick={() => copyInviteLink(inv.token)}
                        >
                          {copiedToken === inv.token ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          Link
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {project && !project.teamReadOnly && (
                  <Button
                    type="button"
                    size="sm"
                    variant={projectSharedWithTeam ? "secondary" : "outline"}
                    disabled={busy}
                    onClick={() => void toggleProjectSharing()}
                    className="w-full text-xs"
                  >
                    {projectSharedWithTeam
                      ? `Stop sharing “${project.name}” with ${activeTeam.name}`
                      : `Share “${project.name}” with ${activeTeam.name}`}
                  </Button>
                )}
                {projectSharedWithTeam && !project?.teamReadOnly && (
                  <p className="text-[11px] text-muted-foreground">
                    Shared as a pointer — one project row under your account; teammates sync live via Realtime.
                  </p>
                )}
                {project?.teamReadOnly && (
                  <p className="text-xs text-muted-foreground">
                    Shared pointer from another member (read-only for your role). Edits sync when the owner saves.
                  </p>
                )}
              </>
            )}

            <div className="border-t border-border pt-3">
              <p className="mb-2 font-mono text-[10px] uppercase text-muted-foreground">join a team</p>
              <div className="flex gap-2">
                <Input
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  placeholder="Paste invite token"
                  className="h-8 font-mono text-xs"
                />
                <Button size="sm" disabled={busy || !inviteToken.trim()} onClick={() => void acceptInvite()} spineId="settings.accept-invite">
                  Join
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
