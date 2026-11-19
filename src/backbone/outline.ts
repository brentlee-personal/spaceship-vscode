export type Stub = {
  id: string
  name: string
  purpose: string
  changes: string
  level: number
  needs: string[]
  produces: string[]
  dependsOn: string[]
  conflicts: string[]
}
export type Outline = { title: string; blocks: Stub[] }
export type Finding = { id: string; message: string }
export function newStub(id: string): Stub {
  return { id, name: "Untitled block", purpose: "", changes: "", level: 1, needs: [], produces: [], dependsOn: [], conflicts: [] }
}
export function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(3, Math.trunc(level))) : 1
}
export function removeBlock(outline: Outline, id: string): Outline {
  return { ...outline, blocks: outline.blocks.filter((b) => b.id !== id) }
}
export function restoreBlock(outline: Outline, block: Stub, index: number): Outline {
  if (outline.blocks.some((b) => b.id === block.id)) return outline
  const blocks = [...outline.blocks]
  blocks.splice(index, 0, block)
  return { ...outline, blocks }
}
export function revise(outline: Outline, id: string, patch: Partial<Omit<Stub, "id">>): Outline {
  return { ...outline, blocks: outline.blocks.map((b) => (b.id === id ? { ...b, ...patch, id } : b)) }
}
export function move(outline: Outline, id: string, offset: number): Outline {
  const blocks = [...outline.blocks],
    from = blocks.findIndex((b) => b.id === id),
    to = from + offset
  if (from < 0 || to < 0 || to >= blocks.length) return outline
  ;[blocks[from], blocks[to]] = [blocks[to], blocks[from]]
  return { ...outline, blocks }
}
export function checkOutline(outline: Outline): Finding[] {
  const findings: Finding[] = [],
    available = new Set<string>(),
    seen = new Set<string>()
  outline.blocks.forEach((b, index) => {
    const add = (message: string) => findings.push({ id: b.id, message })
    if (!b.name.trim() || !b.purpose.trim() || !b.changes.trim()) add("Complete the name, purpose and what changes for this block.")
    if (!Number.isInteger(b.level) || b.level < 1 || b.level > 3 || (index === 0 ? b.level !== 1 : b.level > outline.blocks[index - 1].level + 1))
      add("Fix outline hierarchy: start at level 1 and do not skip a level.")
    for (const need of b.needs) if (!available.has(need)) add(`Missing earlier output: ${need}. Add an earlier producer or revise this input.`)
    for (const dep of b.dependsOn)
      if (!seen.has(dep)) add(`Dependency ${dep} is missing, self-referencing or later in reading order. Move its block earlier or revise the dependency.`)
    for (const conflict of b.conflicts) {
      const other = outline.blocks.find((x) => x.id === conflict)
      add(
        other
          ? `Declared conflict with ${other.name} (${other.id}). Resolve the conflict and remove this declaration.`
          : `Conflict target ${conflict} is missing. Correct or remove it.`,
      )
    }
    for (const output of b.produces) {
      if (available.has(output)) add(`Output ${output} already has an earlier producer. Clarify ownership or use distinct output names.`)
      available.add(output)
    }
    seen.add(b.id)
  })
  return findings
}
const inline = (s: string) => s.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]<>#]/g, "\\$&")
export function exportOutline(outline: Outline): string {
  const findings = checkOutline(outline)
  return (
    `# ${inline(outline.title || "Working outline")}\n\nBackbone outline, not generated prose. ${!outline.blocks.length ? "No blocks yet. Add a block to begin." : findings.length ? `${findings.length} checks need attention.` : "Structural checks passed; author review still required."}\n\n` +
    outline.blocks
      .map(
        (b) =>
          `${"#".repeat(normalizeLevel(b.level) + 1)} ${inline(b.name)}\n\n- ID: ${inline(b.id)}\n- Purpose: ${inline(b.purpose)}\n- What changes: ${inline(b.changes)}\n- Needs: ${b.needs.map(inline).join(", ") || "None declared"}\n- Produces: ${b.produces.map(inline).join(", ") || "None declared"}\n- Dependencies: ${b.dependsOn.map(inline).join(", ") || "None declared"}\n- Conflicts: ${b.conflicts.map(inline).join(", ") || "None declared"}\n${findings
            .filter((f) => f.id === b.id)
            .map((f) => `- Check: ${inline(f.message)}\n`)
            .join("")}`,
      )
      .join("\n")
  )
}
