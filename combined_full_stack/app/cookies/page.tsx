import { COOKIE_SECTIONS } from "@shared/legal/content"
import { CookiePreferences } from "@/components/cookie-preferences"
import { createLegalPage } from "@/lib/legal/create-legal-page"
import { LEGAL } from "@shared/legal/site"

const { metadata, Page } = createLegalPage({
  metadataTitle: `Cookie Policy — ${LEGAL.productName}`,
  documentTitle: "Cookie Policy",
  sections: COOKIE_SECTIONS,
  extra: <CookiePreferences />,
})

export { metadata }
export default Page
