import { scryptSync, timingSafeEqual } from "node:crypto";
export function verifyPassword(password, encoded) {
  try {
    const [salt, hash] = encoded.split(":");
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(hash, "hex");
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}
export function permitted(role, path) {
  if (role === "owner") return true;
  if (role === "barista")
    return /^\/(orders\/[^/]+|menu\/[^/]+|settings)$/.test(path);
  if (role === "floor")
    return /^\/(tables\/[^/]+|move|requests\/[^/]+|receipts)$/.test(path);
  return false;
}
