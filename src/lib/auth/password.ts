import { randomBytes, pbkdf2Sync } from "crypto";

const ITERATIONS = 100000;
const KEY_LEN = 64;
const SALT_LEN = 16;
const DIGEST = "sha256";

export function hashPassword(password: string): { hash: string; salt: string } {
  const salt = randomBytes(SALT_LEN).toString("hex");
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return { hash, salt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST).toString("hex");
  return derived === hash;
}
