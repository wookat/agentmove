import { promises as fs } from "node:fs";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { Bundle, CliError, EXIT_DATA, EXIT_USAGE, emptyBundle, isRecord } from "./model.js";

/**
 * Encrypted single-file bundle ("agentpack") for carrying an agent across
 * machines: gzip(JSON bundle) encrypted with AES-256-GCM, key derived from a
 * passphrase via scrypt (N=2^15, r=8, p=1).
 *
 * Layout: MAGIC (8) | salt (16) | iv (12) | auth tag (16) | ciphertext.
 */
export const PACK_MAGIC = Buffer.from("AMPACK1\n", "utf8");
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const SCRYPT_OPTS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function requirePassphrase(passphrase: string | undefined): string {
  if (passphrase) return passphrase;
  throw new CliError(
    "a passphrase is required: set the AGENTMOVE_PASSPHRASE environment variable",
    EXIT_USAGE,
  );
}

function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return scryptSync(passphrase, salt, 32, SCRYPT_OPTS);
}

export function encryptBundle(bundle: Bundle, passphrase: string): Buffer {
  const plain = gzipSync(Buffer.from(JSON.stringify(bundle), "utf8"));
  const salt = randomBytes(SALT_LEN);
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([PACK_MAGIC, salt, iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBundle(data: Buffer, passphrase: string, label: string): Bundle {
  const headerLen = PACK_MAGIC.length + SALT_LEN + IV_LEN + TAG_LEN;
  if (data.length <= headerLen || !isPack(data)) {
    throw new CliError(`${label}: not an agentmove pack (bad header)`, EXIT_DATA);
  }
  let off = PACK_MAGIC.length;
  const salt = data.subarray(off, (off += SALT_LEN));
  const iv = data.subarray(off, (off += IV_LEN));
  const tag = data.subarray(off, (off += TAG_LEN));
  const ciphertext = data.subarray(off);
  const decipher = createDecipheriv("aes-256-gcm", deriveKey(passphrase, salt), iv);
  decipher.setAuthTag(tag);
  let plain: Buffer;
  try {
    plain = gunzipSync(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  } catch {
    throw new CliError(`${label}: decryption failed (wrong passphrase or corrupted file)`, EXIT_DATA);
  }
  const parsed: unknown = JSON.parse(plain.toString("utf8"));
  if (!isRecord(parsed) || !isRecord(parsed.manifest) || parsed.manifest.schemaVersion !== 1) {
    throw new CliError(`${label}: unsupported bundle schema (expected schemaVersion 1)`, EXIT_DATA);
  }
  return { ...emptyBundle(), ...(parsed as Partial<Bundle>) } as Bundle;
}

export function isPack(data: Buffer): boolean {
  if (data.length < PACK_MAGIC.length) return false;
  return timingSafeEqual(data.subarray(0, PACK_MAGIC.length), PACK_MAGIC);
}

/** True when `p` is a regular file starting with the pack magic. */
export async function isPackFile(p: string): Promise<boolean> {
  try {
    const stat = await fs.stat(p);
    if (!stat.isFile()) return false;
    const fh = await fs.open(p, "r");
    try {
      const buf = Buffer.alloc(PACK_MAGIC.length);
      const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
      return bytesRead === buf.length && isPack(buf);
    } finally {
      await fh.close();
    }
  } catch {
    return false;
  }
}
