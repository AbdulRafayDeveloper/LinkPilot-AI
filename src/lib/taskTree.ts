/**
 * Tasks with subtasks, kept as a flat list where each task names its parent (or none). Daily Tasks
 * stores them that way in the database (`parentTaskId`) and an employee's plan in its array
 * (`parentId`); this is the one place that turns the list into a tree, checks it and copies part of it,
 * so both behave the same. Nothing here touches the database or the page, so it is testable on its own.
 *
 * A tree goes TASK_MAX_DEPTH (3) levels deep: a task is level 1, its subtask 2, that subtask's own 3.
 */

// A task that carries its own subtasks, as Daily Tasks serves them
interface Nested<T> {
  id: string
  subtasks: T[]
}

export interface TreeNode<T> {
  item: T
  // 1 for a task with no parent
  depth: number
  children: TreeNode<T>[]
}

interface Accessors<T> {
  idOf: (item: T) => string
  parentOf: (item: T) => string | null | undefined
}

/**
 * The list as a tree, siblings in the order they have in the list. A task whose parent is not in the
 * list (deleted meanwhile, or never there) is shown at the top rather than lost, and so is one whose
 * parents loop back on themselves, which no write the app makes can produce.
 */
export function buildTree<T>(items: readonly T[], { idOf, parentOf }: Accessors<T>): TreeNode<T>[] {
  const byId = new Map(items.map((item) => [idOf(item), item]))
  // A parent chain that comes back to where it started is broken at the task it starts from
  const hasLoop = (item: T) => {
    const seen = new Set<string>([idOf(item)])
    let parent = parentOf(item)
    while (parent && byId.has(parent)) {
      if (seen.has(parent)) return true
      seen.add(parent)
      parent = parentOf(byId.get(parent) as T)
    }
    return false
  }
  const parentFor = (item: T) => {
    const parent = parentOf(item)
    return parent && parent !== idOf(item) && byId.has(parent) && !hasLoop(item) ? parent : null
  }
  const nodes = new Map(items.map((item) => [idOf(item), { item, depth: 1, children: [] } as TreeNode<T>]))
  const roots: TreeNode<T>[] = []
  for (const item of items) {
    const node = nodes.get(idOf(item)) as TreeNode<T>
    const parent = parentFor(item)
    if (parent) (nodes.get(parent) as TreeNode<T>).children.push(node)
    else roots.push(node)
  }
  const setDepth = (node: TreeNode<T>, depth: number) => {
    node.depth = depth
    for (const child of node.children) setDepth(child, depth + 1)
  }
  for (const root of roots) setDepth(root, 1)
  return roots
}

/** The tree back as a list, each task followed by everything under it. */
export function flattenTree<T>(nodes: readonly TreeNode<T>[]): T[] {
  return nodes.flatMap((node) => [node.item, ...flattenTree(node.children)])
}

/** How deep each task sits, by id (1 for a task with no parent). */
export function depthsOf<T>(items: readonly T[], accessors: Accessors<T>): Map<string, number> {
  const depths = new Map<string, number>()
  const walk = (nodes: TreeNode<T>[]) => {
    for (const node of nodes) {
      depths.set(accessors.idOf(node.item), node.depth)
      walk(node.children)
    }
  }
  walk(buildTree(items, accessors))
  return depths
}

/** A task and everything under it, in list order; empty when that task isn't in the list. */
export function subtreeOf<T>(items: readonly T[], rootId: string, accessors: Accessors<T>): T[] {
  const find = (nodes: TreeNode<T>[]): TreeNode<T> | null => {
    for (const node of nodes) {
      if (accessors.idOf(node.item) === rootId) return node
      const found = find(node.children)
      if (found) return found
    }
    return null
  }
  const root = find(buildTree(items, accessors))
  return root ? flattenTree([root]) : []
}

/** How many levels a task and what is under it take up: 1 for a task with no subtasks. */
export function heightOf<T>(items: readonly T[], rootId: string, accessors: Accessors<T>): number {
  const subtree = subtreeOf(items, rootId, accessors)
  if (subtree.length === 0) return 0
  const depths = depthsOf(subtree, { ...accessors, parentOf: (item) => (accessors.idOf(item) === rootId ? null : accessors.parentOf(item)) })
  return Math.max(...depths.values())
}

/**
 * The same tasks with the ticked ones at the end of their own list, so finishing one sends it to the
 * bottom without anybody dragging it, and unticking brings it back where it was. Only ticked and
 * unticked change places: tasks that are alike keep the order they had, a task takes everything under
 * it along, and the subtasks of one task are sorted among themselves only.
 */
export function completedLast<T>(items: readonly T[], accessors: Accessors<T> & { doneOf: (item: T) => boolean }): T[] {
  const sort = (nodes: TreeNode<T>[]): TreeNode<T>[] => {
    const inOrder = [...nodes].sort((first, second) => Number(accessors.doneOf(first.item)) - Number(accessors.doneOf(second.item)))
    return inOrder.map((node) => ({ ...node, children: sort(node.children) }))
  }
  return flattenTree(sort(buildTree(items, accessors)))
}

/** The same rule for tasks that already carry their own subtasks, as a page holds them after a tick. */
export function completedLastNested<T extends Nested<T> & { isCompleted: boolean }>(tasks: readonly T[]): T[] {
  return [...tasks]
    .sort((first, second) => Number(first.isCompleted) - Number(second.isCompleted))
    .map((task) => (task.subtasks.length > 0 ? { ...task, subtasks: completedLastNested(task.subtasks) } : task))
}

export type TreeProblem = "missing-parent" | "loop" | "too-deep"

/**
 * What is wrong with a list sent to be saved, or null when it is a tree the app can keep: every
 * parent is in the list, no parent chain loops, and nothing sits deeper than `maxDepth`.
 */
export function treeProblem<T>(items: readonly T[], accessors: Accessors<T>, maxDepth: number): TreeProblem | null {
  const ids = new Set(items.map(accessors.idOf))
  for (const item of items) {
    const parent = accessors.parentOf(item)
    if (parent && (parent === accessors.idOf(item) || !ids.has(parent))) return "missing-parent"
  }
  const byId = new Map(items.map((item) => [accessors.idOf(item), item]))
  for (const item of items) {
    const seen = new Set<string>()
    let depth = 1
    let parent = accessors.parentOf(item)
    while (parent) {
      if (seen.has(parent)) return "loop"
      seen.add(parent)
      depth++
      parent = accessors.parentOf(byId.get(parent) as T)
    }
    if (depth > maxDepth) return "too-deep"
  }
  return null
}

/* ------------------------------------------------------------------ tasks already nested */

/** The same tasks with one of them changed, wherever it sits. */
export function updateNested<T extends Nested<T>>(tasks: readonly T[], id: string, change: (task: T) => T): T[] {
  return tasks.map((task) => (task.id === id ? change(task) : task.subtasks.length > 0 ? { ...task, subtasks: updateNested(task.subtasks, id, change) } : task))
}

/** The same tasks without one of them (and what was under it), wherever it sat. */
export function removeNested<T extends Nested<T>>(tasks: readonly T[], id: string): T[] {
  return tasks.filter((task) => task.id !== id).map((task) => (task.subtasks.length > 0 ? { ...task, subtasks: removeNested(task.subtasks, id) } : task))
}

/** The tasks from the top down to the one asked for, it included; null when it isn't there. */
export function pathTo<T extends Nested<T>>(tasks: readonly T[], id: string): T[] | null {
  for (const task of tasks) {
    if (task.id === id) return [task]
    const below = pathTo(task.subtasks, id)
    if (below) return [task, ...below]
  }
  return null
}
