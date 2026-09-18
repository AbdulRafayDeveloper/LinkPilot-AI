/**
 * Putting a list in a new order: one row moved, or several picked rows moved together. It is kept
 * apart from the list that draws them so the ordering can be reasoned about, and tested, on its own.
 */

/** One row taken out of the list and put back at another place. */
export function move(ids: string[], from: number, to: number): string[] {
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Several rows landing where the dragged one was dropped, keeping the order they had in the list.
 * The dragged row is moved first, exactly as one row on its own would be, and the rest of the
 * picked rows close up around it, so where the group lands is where the dragged row was let go.
 * Dragging a row that nobody picked moves that row alone, whatever else is picked.
 */
export function moveMany(ids: string[], picked: ReadonlySet<string>, from: number, to: number): string[] {
  const dragged = ids[from]
  if (picked.size <= 1 || !picked.has(dragged)) return move(ids, from, to)
  const single = move(ids, from, to)
  const group = ids.filter((id) => picked.has(id))
  const rest = single.filter((id) => !picked.has(id))
  // How many rows that are staying put end up above the dragged row: the group goes in there
  const anchor = single.indexOf(dragged)
  const above = single.slice(0, anchor).filter((id) => !picked.has(id)).length
  return [...rest.slice(0, above), ...group, ...rest.slice(above)]
}
