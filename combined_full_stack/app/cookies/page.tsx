import { COOKIE_SECTIONS } from "@shared/legal/content"
import { CookiePreferences } from "@/components/cookie-preferences"
import { createLegalPage } from "@/lib/legal/create-legal-page"

const { metadata, Page } = createLegalPage({
  metadataTitle: "Cookie Policy — Spine",
  documentTitle: "Cookie Policy",
  sections: COOKIE_SECTIONS,
  extra: <CookiePreferences />,
})

export { metadata }
export default Page
