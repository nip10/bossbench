import { timingSafeEqual } from "node:crypto";

export function checkBasicAuth(
  authHeader: string | undefined,
  username: string,
  password: string,
) {
  if (!authHeader?.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const at = decoded.indexOf(":");
    if (at < 0) return false;
    return (
      safeEqual(decoded.slice(0, at), username) &&
      safeEqual(decoded.slice(at + 1), password)
    );
  } catch {
    return false;
  }
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
