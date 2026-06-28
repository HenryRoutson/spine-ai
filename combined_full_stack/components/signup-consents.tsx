import Link from "next/link"
import { LEGAL, LEGAL_ROUTES } from "@shared/legal/site"

type SignupConsentsProps = {
  disabled?: boolean
}

export function SignupConsents({ disabled }: SignupConsentsProps) {
  return (
    <fieldset disabled={disabled} className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <legend className="px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Required to create an account
      </legend>

      <label className="flex items-start gap-2 text-xs leading-relaxed">
        <input
          type="checkbox"
          name="age_confirmed"
          value="yes"
          required
          className="mt-0.5"
        />
        <span>
          I confirm I am at least {LEGAL.minAgeYears} years old (or the age of digital consent in my
          country, if higher).
        </span>
      </label>

      <label className="flex items-start gap-2 text-xs leading-relaxed">
        <input type="checkbox" name="accept_terms" value="yes" required className="mt-0.5" />
        <span>
          I agree to the{" "}
          <Link href={LEGAL_ROUTES.terms} target="_blank" className="underline underline-offset-2">
            Terms of Service
          </Link>{" "}
          (version {LEGAL.policyVersion}).
        </span>
      </label>

      <label className="flex items-start gap-2 text-xs leading-relaxed">
        <input type="checkbox" name="accept_privacy" value="yes" required className="mt-0.5" />
        <span>
          I have read the{" "}
          <Link href={LEGAL_ROUTES.privacy} target="_blank" className="underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </span>
      </label>

      <label className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <input type="checkbox" name="marketing_opt_in" value="yes" className="mt-0.5" />
        <span>Send me product updates and marketing emails (optional).</span>
      </label>
    </fieldset>
  )
}
