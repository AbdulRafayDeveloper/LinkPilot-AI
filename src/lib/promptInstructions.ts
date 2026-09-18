/**
 * The standing instructions a Prompt Creator project adds to every prompt written in it. Kept here,
 * away from the database, so it is one small piece of text handling that can be read and tested on
 * its own.
 */

/**
 * The finished prompt with the project's instructions on the end, under a heading so they read as
 * part of the prompt rather than a stray paragraph. A project with no instructions, or a prompt
 * that already carries them, is left exactly as it was.
 */
export function appendInstructions(prompt: string, instructions: string): string {
  const block = instructions.trim()
  if (!block) return prompt
  const body = prompt.trimEnd()
  if (body.includes(block)) return prompt
  return `${body}\n\nADDITIONAL INSTRUCTIONS\n${block}`
}
