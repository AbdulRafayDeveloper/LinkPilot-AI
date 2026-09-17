import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto"

/**
 * Password hashing with scrypt, from Node itself. A hash is stored as
 * `scrypt$N$r$p$salt$hash` (salt and hash in base64url), so the cost can be raised later without
 * breaking the hashes already stored. The account scripts in scripts/ write this same format.
 */

const COST = { N: 16384, r: 8, p: 1 }
const KEY_LENGTH = 64
const SALT_BYTES = 16

function derive(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, { ...options, maxmem: 64 * 1024 * 1024 }, (error, key) =>
      error ? reject(error) : resolve(key)
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const key = await derive(password, salt, COST)
  return ["scrypt", COST.N, COST.r, COST.p, salt.toString("base64url"), key.toString("base64url")].join("$")
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split("$")
  if (scheme !== "scrypt" || !salt || !hash) return false
  const expected = Buffer.from(hash, "base64url")
  const key = await derive(password, Buffer.from(salt, "base64url"), { N: Number(n), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

// Checked against when the email matches no account, so a wrong email takes as long as a wrong password
let decoyHash: Promise<string> | null = null
export function decoyPasswordHash(): Promise<string> {
  decoyHash ??= hashPassword(randomBytes(12).toString("hex"))
  return decoyHash
}
