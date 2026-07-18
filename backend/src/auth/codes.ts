import { createHash, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePlayerCode(houseId: string, length = 4): string {
  let suffix = "";
  for (let i = 0; i < length; i++) {
    suffix += ALPHABET[randomInt(ALPHABET.length)];
  }
  return `${houseId}-${suffix}`;
}

export function hashCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
