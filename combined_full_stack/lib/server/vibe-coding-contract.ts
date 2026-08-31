// AI : schema-valid is not done — catch empty spines and identical fixtures (reward-hacking cheap pass).
export function vibeContractIssues(args: {
  kinds: string[]
  docs?: Array<{ content: string }> | null
}): string[] {
  const kinds = args.kinds.filter(Boolean)
  const issues: string[] = []
  const transforming = kinds.filter((k) => k !== "input" && k !== "output" && k !== "human-review")
  if (!transforming.length) {
    issues.push("no transforming step — input→output stubs are not done")
  }
  const contents = (args.docs ?? []).map((d) => d.content.trim()).filter(Boolean)
  if (contents.length >= 2 && new Set(contents).size < 2) {
    issues.push("test fixtures are identical — two different inputs are required so a passthrough cannot pass")
  }
  return issues
}
