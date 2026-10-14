import { APP_TOOLS, TOOL_GROUPS, type ToolGroupId } from "@/constants/linkedinTools"
import { DUMMY_DATA_KINDS, type DummyDataKind } from "@/constants/dummyData"

/**
 * Which tool each piece of sample data belongs to.
 *
 * Dummy Data for Testing is read **tool wise**: an admin picks the tool they are about to test and
 * sees that tool's sample data alone. So the page needs the tools, not the kinds, and it needs them
 * named and ordered exactly as the sidebar names and orders them, because that is the list the
 * admin is looking at while they work. `APP_TOOLS` is the app's one navigation source, so the names
 * can never drift: a tool renamed there is renamed here.
 *
 * A kind several tools share (a profile fills Connection Note, First Message and InMail) is listed
 * under **each** of them, one `uses` href at a time, which is what lets the page show one "Use in
 * <tool>" button per card and never a row of tool tags on one item.
 */

export interface DummyTool {
  // The tool's own page, which is also what a kind's `uses` names it by
  href: string
  // Exactly the sidebar's own title, so a tool is found by the name the admin already knows
  title: string
  // The sidebar heading it sits under, shown beside the title where the areas are worth telling apart
  heading: string
  // The kinds whose sample data this tool takes, in registry order
  kinds: readonly DummyDataKind[]
}

// `uses` is a readonly tuple of literal addresses, so it is read as plain strings to search
const usesOf = (kind: DummyDataKind): readonly string[] => DUMMY_DATA_KINDS[kind].uses

const headingOf = (group: ToolGroupId) => TOOL_GROUPS.find((entry) => entry.id === group)?.label ?? ""

/**
 * Every tool that has sample data, in the sidebar's order. A tool no kind names is left out
 * entirely rather than offered with an empty list: Trending Topics takes no input at all, so there
 * is nothing sample data could fill in it.
 */
export function dummyTools(): DummyTool[] {
  const kinds = Object.keys(DUMMY_DATA_KINDS) as DummyDataKind[]
  return APP_TOOLS.map((tool) => ({
    href: tool.href,
    title: tool.title,
    heading: headingOf(tool.group),
    kinds: kinds.filter((kind) => usesOf(kind).includes(tool.href)),
  })).filter((tool) => tool.kinds.length > 0)
}

/** The tool a kind's own editor belongs to, for an item opened where no tool is chosen. */
export function toolForKind(kind: DummyDataKind): DummyTool | null {
  const [href] = usesOf(kind)
  return dummyTools().find((tool) => tool.href === href) ?? null
}
