import { describe, expect, it } from "vitest"
import {
  patchHostedSiteHtmlText,
  stampHostedSiteHsIds,
  stripHostedSiteHsIds,
} from "@/lib/hosted-site-select"
import { splitHostedSiteSlots } from "@/lib/hosted-site-slots"

describe("hosted site click-to-edit", () => {
  it("stamps stable data-hs-id on opening tags and strips them", () => {
    const html = `<header class="hs-hero"><h1 class="hs-title">Hello</h1></header>`
    const stamped = stampHostedSiteHsIds(html)
    expect(stamped).toContain('data-hs-id="1"')
    expect(stamped).toContain('data-hs-id="2"')
    expect(stripHostedSiteHsIds(stamped)).toBe(html)
  })

  it("patches text by data-hs-id without an LLM", () => {
    const html = `<header class="hs-hero"><h1 class="hs-title">{{tagline}}</h1></header>`
    const stamped = stampHostedSiteHsIds(html)
    const h1 = /data-hs-id="(\d+)"/.exec(stamped.slice(stamped.indexOf("<h1")))
    expect(h1?.[1]).toBeTruthy()
    const next = patchHostedSiteHtmlText(html, h1![1]!, "Invoice ops")
    expect(next).toContain("Invoice ops")
    expect(next).not.toContain("{{tagline}}")
    expect(next).not.toContain("data-hs-id")
  })

  it("preserves {{docs}} when click-to-edit would wipe a container that holds slots", () => {
    const html = `<section class="hs-run"><div class="hs-workspace-head"><h2>Run</h2></div>\n{{docs}}\n{{run}}\n</section>`
    const stamped = stampHostedSiteHsIds(html)
    const section = /data-hs-id="(\d+)"/.exec(stamped)
    expect(section?.[1]).toBeTruthy()
    const next = patchHostedSiteHtmlText(html, section![1]!, "wiped")
    expect(next).toContain("{{docs}}")
    expect(next).toContain("{{run}}")
    expect(next).not.toContain("wiped")
  })
})

describe("hosted site extra slots", () => {
  it("splits {{output}} {{chatbot}} {{docs}} alongside {{run}}", () => {
    const html = `<h1>Hi</h1>{{docs}}{{run}}{{output}}{{chatbot}}`
    const segments = splitHostedSiteSlots(html)
    expect(segments.map((s) => (s.kind === "slot" ? s.slot : "html"))).toEqual([
      "html",
      "docs",
      "run",
      "output",
      "chatbot",
    ])
  })

  it("splits {{pay}} and named {{table:Model}} slots", () => {
    const html = `<section>{{pay}}</section>{{table:Lead}}`
    const segments = splitHostedSiteSlots(html)
    expect(segments.filter((s) => s.kind === "slot")).toEqual([
      { kind: "slot", slot: "pay" },
      { kind: "slot", slot: "table", alias: "Lead" },
    ])
  })
})
