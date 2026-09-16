/**
 * One Dummy Data item (a sample profile, post, comment thread, conversation, ...) kept in
 * the dummy_data collection, for filling a tool's inputs.
 */
export interface DummyItem {
  id: string
  name: string
  // One value per field of the item's kind (see DUMMY_DATA_KINDS), keyed by field key
  fields: Record<string, string>
  // ISO timestamp; items are listed oldest first
  createdAt: string
}
