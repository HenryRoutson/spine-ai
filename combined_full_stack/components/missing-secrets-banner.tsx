"use client"

import { KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAppShell } from "@/lib/app-shell"
import { groupSecretRequirements, missingWebhookSecretMessage } from "@/lib/webhook-step"
import type { SecretRequirementStatus } from "@/lib/webhook-step"

export function MissingSecretsBanner({
  missing,
  simple = false,
}: {
  missing: SecretRequirementStatus[]
  simple?: boolean
}) {
  const { openSecrets } = useAppShell()
  const grouped = groupSecretRequirements(missing)
  if (!grouped.length) return null
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-5 text-center">
      <KeyRound className="mx-auto h-8 w-8 text-destructive" />
      <p className="mt-3 text-sm font-medium text-destructive">
        {grouped.length === 1 ? "Required secret is missing" : "Required secrets are missing"}
      </p>
      <ul className="mt-2 space-y-1 font-mono text-[11px] text-muted-foreground">
        {grouped.map((g) => (
          <li key={g.name}>
            {simple
              ? `${g.name} — required by ${g.steps.join(", ")}`
              : missingWebhookSecretMessage(g.name) + ` Required by: ${g.steps.join(", ")}.`}
          </li>
        ))}
      </ul>
      <Button
        variant="outline"
        size="sm"
        className="mt-4 gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => openSecrets()}
      >
        <KeyRound className="h-3.5 w-3.5" />
        Go to Secrets
      </Button>
    </div>
  )
}
