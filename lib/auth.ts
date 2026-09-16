import crypto from "node:crypto";
import { query } from "./db";

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function newProxyToken() {
  return `px_live_${crypto.randomBytes(24).toString("hex")}`;
}

export function safeEqual(a: string, b: string) {
  const aa = Buffer.from(a);
  const bb = Buffer.from(b);
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export async function requireAdmin(request: Request) {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) return false;
  const auth = request.headers.get("authorization") ?? "";
  if (!auth.startsWith("Basic ")) return false;
  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const supplied = decoded.split(":").slice(1).join(":");
  return safeEqual(supplied, password);
}

export async function getProjectByToken(token: string) {
  const result = await query<{
    id: string;
    name: string;
  }>(
    `SELECT id, name FROM projects WHERE proxy_token_hash = $1`,
    [hashToken(token)]
  );
  return result.rows[0] ?? null;
}
