/**
 * The names the drop targets carry while records are dragged onto folders, on a "view all" page and
 * in Personal Drive. Kept away from the components so the rules can be read and tested on their own.
 */

// Dropping here takes a record out of whatever folder it is in
export const UNFILED_DROP = "none"

const PREFIX = "folder-drop:"

/**
 * The name one place to drop on carries.
 *
 * **The place is part of the name**, because the same folder is offered in more than one place at
 * once: Personal Drive shows it on the tree, as a tile among the files, and in the line saying where
 * you are. Two drop targets sharing a name are one target to the library, which keeps a single
 * element for it, so a drop on the tree was measured against the tile and missed every time. A page
 * with one place to drop on simply leaves `place` out.
 */
export const folderDropId = (id: string, place = "list") => `${PREFIX}${place}:${id}`

/**
 * The folder a drop target stands for: its id, `null` for "no folder", and `undefined` when the
 * thing dropped on is not a folder at all, so nothing is filed by accident.
 */
export function folderFromDropId(id: string): string | null | undefined {
  if (!id.startsWith(PREFIX)) return undefined
  const rest = id.slice(PREFIX.length)
  const folder = rest.slice(rest.indexOf(":") + 1)
  return folder === UNFILED_DROP ? null : folder
}

interface DropBox {
  id: string
  // The place it covers on screen, as the browser reports it
  rect: { left: number; top: number; right: number; bottom: number }
}

/**
 * The folders under the pointer, the **smallest first**, which is what a drop should file into.
 *
 * It is the rule a drive wants and it is written here rather than taken from the library, for two
 * reasons. dnd-kit's own `closestCenter` compares the **dragged card's** rectangle, which is far
 * larger than a folder row, so a drop landed on whichever folder it happened to overlap rather than
 * the one being pointed at; and its `pointerWithin` reads rectangles it measured when the drag
 * started, which did not match what was on screen here, so it found nothing at all and every drop
 * fell through to the wrong rule. Measuring where the folders really are, on each move, is cheap
 * (one rectangle per folder row) and cannot drift from what the user sees.
 *
 * Smallest first matters because the targets nest: the tree's own row sits inside the panel, and a
 * folder's tile inside the list. The tightest box around the pointer is the one meant.
 */
export function foldersUnderPointer(boxes: readonly DropBox[], pointer: { x: number; y: number }): string[] {
  return boxes
    .filter((box) => pointer.x >= box.rect.left && pointer.x <= box.rect.right && pointer.y >= box.rect.top && pointer.y <= box.rect.bottom)
    .map((box) => ({ id: box.id, area: Math.max(0, box.rect.right - box.rect.left) * Math.max(0, box.rect.bottom - box.rect.top) }))
    .sort((a, b) => a.area - b.area)
    .map((box) => box.id)
}
