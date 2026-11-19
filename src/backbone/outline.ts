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
export function canRemove(outline: Outline, id: string): boolean {
  const index = outline.blocks.findIndex((b) => b.id === id)
  return index >= 0 && (index + 1 === outline.blocks.length || outline.blocks[index + 1].level <= outline.blocks[index].level)
}
export function removeBlock(outline: Outline, id: string): Outline {
  if (!canRemove(outline, id)) return outline
  return { ...outline, blocks: outline.blocks.filter((b) => b.id !== id) }
}
export function parentId(outline: Outline, id: string): string | null {
  const index = outline.blocks.findIndex((b) => b.id === id)
  if (index < 0) return null
  for (let i = index - 1; i >= 0; i--) if (outline.blocks[i].level < outline.blocks[index].level) return outline.blocks[i].id
  return null
}
export function restoreBlock(outline: Outline, block: Stub, index: number, expectedParent?: string | null): Outline {
  if (outline.blocks.some((b) => b.id === block.id)) return outline
  const blocks = [...outline.blocks]
  blocks.splice(index, 0, block)
  const restored = { ...outline, blocks }
  if (expectedParent !== undefined && parentId(restored, block.id) !== expectedParent) return outline
  if (outline.blocks.some((existing) => parentId(restored, existing.id) !== parentId(outline, existing.id))) return outline
  return restored
}
export function revise(outline: Outline, id: string, patch: Partial<Omit<Stub, "id">>): Outline {
  return { ...outline, blocks: outline.blocks.map((b) => (b.id === id ? { ...b, ...patch, id } : b)) }
}
function moveRange(outline: Outline, id: string, direction: number): [number, number, number] | undefined {
  const blocks = outline.blocks
  // Invalid nesting has no unambiguous parent. Repair levels before reordering.
  if (direction !== -1 && direction !== 1) return
  if (blocks.some((b, i) => !Number.isInteger(b.level) || b.level < 1 || b.level > 3 || (i === 0 ? b.level !== 1 : b.level > blocks[i - 1].level + 1))) return
  const from = blocks.findIndex((b) => b.id === id)
  if (from < 0) return
  const level = blocks[from].level
  let end = from + 1
  while (end < blocks.length && blocks[end].level > level) end++
  if (direction === 1) {
    if (end === blocks.length || blocks[end].level !== level) return
    let nextEnd = end + 1
    while (nextEnd < blocks.length && blocks[nextEnd].level > level) nextEnd++
    return [from, end, nextEnd]
  }
  let previous = from - 1
  while (previous >= 0 && blocks[previous].level > level) previous--
  if (previous < 0 || blocks[previous].level !== level) return
  return [previous, from, end]
}
export function canMove(outline: Outline, id: string, direction: number): boolean {
  return moveRange(outline, id, direction) !== undefined
}
export function move(outline: Outline, id: string, direction: number): Outline {
  const range = moveRange(outline, id, direction)
  if (!range) return outline
  const [start, middle, end] = range
  const blocks = outline.blocks
  return { ...outline, blocks: [...blocks.slice(0, start), ...blocks.slice(middle, end), ...blocks.slice(start, middle), ...blocks.slice(end)] }
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
