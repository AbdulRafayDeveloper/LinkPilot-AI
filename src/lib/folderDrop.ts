/**
 * The names the drop targets carry while records are dragged onto folders on a "view all" page.
 * Kept away from the components so the rule can be read and tested on its own.
 */

// Dropping here takes a record out of whatever folder it is in
export const UNFILED_DROP = "none"

const PREFIX = "folder-drop:"

export const folderDropId = (id: string) => `${PREFIX}${id}`

/**
 * The folder a drop target stands for: its id, `null` for "no folder", and `undefined` when the
 * thing dropped on is not a folder at all, so nothing is filed by accident.
 */
export function folderFromDropId(id: string): string | null | undefined {
  if (!id.startsWith(PREFIX)) return undefined
  const folder = id.slice(PREFIX.length)
  return folder === UNFILED_DROP ? null : folder
}
