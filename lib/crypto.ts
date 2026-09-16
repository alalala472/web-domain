import crypto from "node:crypto";

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ENCRYPTION_KEY is missing.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must decode to exactly 32 bytes.");
  }
  return key;
}

export function encryptSecret(plain: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(payload: string) {
  const [iv64, tag64, data64] = payload.split(".");
  if (!iv64 || !tag64 || !data64) throw new Error("Invalid encrypted secret.");
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(iv64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(data64, "base64")),
    decipher.final()
  ]).toString("utf8");
}
