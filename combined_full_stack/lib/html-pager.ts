// AI : one pager implementation — live IoPager + saved HTML both call bindHtmlPagers.

export const HTML_PAGER_ATTR = "data-html-pager"
export const HTML_PAGER_PAGES_ATTR = "data-html-pager-pages"
export const HTML_PAGER_PREV_ATTR = "data-html-pager-prev"
export const HTML_PAGER_NEXT_ATTR = "data-html-pager-next"
export const HTML_PAGER_LABEL_TEXT_ATTR = "data-html-pager-label-text"
export const HTML_PAGER_LABEL_COUNT_ATTR = "data-html-pager-label-count"
export const HTML_PAGER_ITEM_LABEL_ATTR = "data-html-pager-item-label"

export const HTML_PAGER_BTN_CLASS =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border text-muted-foreground hover:text-foreground disabled:opacity-30"

export type HtmlPagerBoot = {
  pagerAttr: string
  pagesAttr: string
  prevAttr: string
  nextAttr: string
  labelTextAttr: string
  labelCountAttr: string
  itemLabelAttr: string
}

export const HTML_PAGER_BOOT: HtmlPagerBoot = {
  pagerAttr: HTML_PAGER_ATTR,
  pagesAttr: HTML_PAGER_PAGES_ATTR,
  prevAttr: HTML_PAGER_PREV_ATTR,
  nextAttr: HTML_PAGER_NEXT_ATTR,
  labelTextAttr: HTML_PAGER_LABEL_TEXT_ATTR,
  labelCountAttr: HTML_PAGER_LABEL_COUNT_ATTR,
  itemLabelAttr: HTML_PAGER_ITEM_LABEL_ATTR,
}

export const HTML_PAGER_ROOT_PROPS = { [HTML_PAGER_ATTR]: "" }
export const HTML_PAGER_PAGES_PROPS = { [HTML_PAGER_PAGES_ATTR]: "" }
export const HTML_PAGER_PREV_PROPS = { [HTML_PAGER_PREV_ATTR]: "" }
export const HTML_PAGER_NEXT_PROPS = { [HTML_PAGER_NEXT_ATTR]: "" }
export const HTML_PAGER_LABEL_TEXT_PROPS = { [HTML_PAGER_LABEL_TEXT_ATTR]: "" }
export const HTML_PAGER_LABEL_COUNT_PROPS = { [HTML_PAGER_LABEL_COUNT_ATTR]: "" }

export function pagerCountLabel(index: number, length: number): string {
  return "(" + (index + 1) + "/" + length + ")"
}

// AI : no free variables — htmlPagerBootScript embeds this via Function#toString.
export function bindHtmlPagers(root: ParentNode, opts: HtmlPagerBoot): () => void {
  const unbind: Array<() => void> = []
  const pagerSel = "[" + opts.pagerAttr + "]"
  const pagers =
    root instanceof Element && root.getAttribute(opts.pagerAttr) !== null
      ? [root]
      : Array.prototype.slice.call(root.querySelectorAll(pagerSel))

  for (let p = 0; p < pagers.length; p++) {
    const pager = pagers[p] as Element
    const pagesRoot = pager.querySelector(":scope > [" + opts.pagesAttr + "]")
    if (!pagesRoot) continue
    const pages = Array.prototype.slice.call(pagesRoot.children) as HTMLElement[]
    if (pages.length < 2) continue

    function own(sel: string): HTMLElement | null {
      const nodes = pager.querySelectorAll(sel)
      for (let n = 0; n < nodes.length; n++) {
        const el = nodes[n] as HTMLElement
        if (el.closest(pagerSel) === pager) return el
      }
      return null
    }

    const prev = own("[" + opts.prevAttr + "]") as HTMLButtonElement | null
    const next = own("[" + opts.nextAttr + "]") as HTMLButtonElement | null
    const labelText = own("[" + opts.labelTextAttr + "]")
    const labelCount = own("[" + opts.labelCountAttr + "]")
    let i = 0
    for (let n = 0; n < pages.length; n++) {
      if (!pages[n]!.hidden) {
        i = n
        break
      }
    }

    function show(n: number): void {
      i = Math.max(0, Math.min(pages.length - 1, n))
      for (let j = 0; j < pages.length; j++) pages[j]!.hidden = j !== i
      if (prev) prev.disabled = i <= 0
      if (next) next.disabled = i >= pages.length - 1
      const lab = pages[i]!.getAttribute(opts.itemLabelAttr) || ""
      if (labelText) labelText.textContent = lab
      if (labelCount) labelCount.textContent = "(" + (i + 1) + "/" + pages.length + ")"
    }

    function onPrev(): void {
      show(i - 1)
    }
    function onNext(): void {
      show(i + 1)
    }
    if (prev) {
      prev.addEventListener("click", onPrev)
      unbind.push(function () {
        prev.removeEventListener("click", onPrev)
      })
    }
    if (next) {
      next.addEventListener("click", onNext)
      unbind.push(function () {
        next.removeEventListener("click", onNext)
      })
    }
    show(i)
  }

  return function () {
    for (let u = 0; u < unbind.length; u++) unbind[u]!()
  }
}

export function htmlPagerBootScript(): string {
  return `(${bindHtmlPagers.toString()})(document, ${JSON.stringify(HTML_PAGER_BOOT)});`
}
