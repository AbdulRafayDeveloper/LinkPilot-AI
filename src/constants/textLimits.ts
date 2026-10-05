/**
 * How long a plain text box may be when nothing reads it but the user.
 *
 * The modules that only store, search and show text (Important Content, Quick Notes, Reference
 * Content, a file's description, a client project's description, an employee plan's notes) have no
 * reason to cut a long paste short: nothing is sent to a model, so there is no context window and no
 * token cost, and MongoDB holds up to 16 MB in one document. So they share this one ceiling instead
 * of each keeping a small number of their own.
 *
 * A million characters is about 1 MB of English and up to 3 MB written in Urdu or Arabic, which
 * still fits the 4.5 MB a request body may be on the host. It is not for anything a model reads:
 * a tool's pasted profile, conversation, transcript, update or prompt keeps its own smaller limit,
 * because a model has a context window and every character of it is paid for.
 */
export const TEXT_BOX_MAX_LENGTH = 1_000_000

/**
 * A `fetch` marked `keepalive` (what a dialog uses to send a waiting edit as the page goes) may
 * carry only 64 KiB in Chrome, and the whole request is refused when it is larger. So a body over
 * this is sent as an ordinary request, which the browser may still cancel but will not reject
 * outright. `Blob` measures the bytes rather than the characters, since one character can be three.
 */
const KEEPALIVE_MAX_BYTES = 64 * 1024

export const canKeepalive = (body: string): boolean => new Blob([body]).size <= KEEPALIVE_MAX_BYTES
