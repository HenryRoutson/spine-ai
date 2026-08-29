"use client"

import { CreditCard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { spineActionProps } from "@/lib/core/parity"

// AI : {{pay}} widget — hosted pages reuse share funding; isolated Stripe Connect is out of this slice.
export function HostedPaySlot({
  companyName,
  onCheckout,
}: {
  companyName: string
  onCheckout?: () => void
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium">Checkout</p>
          <p className="text-xs text-muted-foreground">
            Runs on {companyName.trim() || "this workspace"} use the share link&apos;s funding mode — you pay, or the
            visitor pays after sign-in.
          </p>
          <Button
            type="button"
            size="sm"
            className="h-8"
            onClick={onCheckout}
            disabled={!onCheckout}
            {...spineActionProps("platform.pay-slot")}
          >
            Continue to pay
          </Button>
        </div>
      </div>
    </div>
  )
}
