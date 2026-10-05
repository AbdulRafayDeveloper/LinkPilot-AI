/**
 * One folder, whichever module keeps it: a name plus how many of that module's records are filed in
 * it. Prompt Creator files created prompts (`prompt_folders`), Important Content files its entries
 * (`content_folders`); both read and write the same shape, so the folder UI is written once.
 */
export interface RecordFolder {
  id: string
  name: string
  // How many records are in it, of whatever kind the module keeps
  recordCount: number
}
