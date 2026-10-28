// AI : one-click share POST bodies — must stay inside the .strict() create schemas.
import { normalizeHostedSiteOptions } from "@/lib/hosted-site"
import { DEFAULT_HOSTED_SITE_OPTIONS, type HostedSiteOptions } from "@/lib/shared-link-types"
import { SharedLinkFundingMode, type ProjectId } from "@/lib/types"
import { websiteNameForCreate } from "@/lib/website-pipelines"

export type platform_share_site_body = {
  projectId: ProjectId
  kind: "site"
  fundingMode: SharedLinkFundingMode.SharerPays
  siteOptions: HostedSiteOptions
}

export type platform_share_link_body = {
  projectId: ProjectId
  fundingMode: SharedLinkFundingMode.SharerPays
}

export type platform_share_api_body = {
  projectId: ProjectId
}

export type platform_share_bodies = {
  site: platform_share_site_body
  link: platform_share_link_body
  api: platform_share_api_body
}

const COMPANY_NAME_MAX = 80

export function platformShareBodies(input: {
  projectId: ProjectId
  name: string
  siteOptions?: HostedSiteOptions
}): platform_share_bodies {
  const companyName = websiteNameForCreate(input.name).slice(0, COMPANY_NAME_MAX)
  const base = normalizeHostedSiteOptions(
    input.siteOptions ?? {
      ...DEFAULT_HOSTED_SITE_OPTIONS,
      brand: { ...DEFAULT_HOSTED_SITE_OPTIONS.brand, companyName },
    },
  )
  return {
    site: {
      projectId: input.projectId,
      kind: "site",
      fundingMode: SharedLinkFundingMode.SharerPays,
      siteOptions: {
        ...base,
        brand: { ...base.brand, companyName: companyName || base.brand.companyName },
      },
    },
    link: {
      projectId: input.projectId,
      fundingMode: SharedLinkFundingMode.SharerPays,
    },
    api: {
      projectId: input.projectId,
    },
  }
}

export function absoluteShareUrl(path: string, origin: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const prefix = origin.replace(/\/$/, "")
  return `${prefix}${path.startsWith("/") ? path : `/${path}`}`
}
