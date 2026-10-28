import type { LegalSection } from "@shared/legal/content"
import { LEGAL_DISCLAIMER } from "@shared/legal/content"
import { LEGAL } from "@shared/legal/site"

type LegalDocumentProps = {
  title: string
  sections: LegalSection[]
  className?: string
}

export function LegalDocument({ title, sections, className }: LegalDocumentProps) {
  return (
    <article className={className}>
      <header className="mb-8 border-b pb-6">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Version {LEGAL.policyVersion} · Last updated {LEGAL.lastUpdated}
        </p>
        <p className="mt-3 text-xs text-muted-foreground">{LEGAL_DISCLAIMER}</p>
      </header>
      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.id} id={section.id}>
            <h2 className="text-lg font-medium">{section.title}</h2>
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </article>
  )
}
