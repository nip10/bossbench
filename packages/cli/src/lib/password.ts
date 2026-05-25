import { randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generatePassword(length = 24) {
  const bytes = randomBytes(length);
  return Array.from(
    { length },
    (_, i) => ALPHABET[(bytes[i] ?? 0) % ALPHABET.length],
  ).join("");
}
