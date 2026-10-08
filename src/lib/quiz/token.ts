import crypto from "node:crypto";
import type { Angle } from "@/lib/catalog/schema";
import type { Conditions, Exposure } from "@/lib/deck/config";

/**
 * A sealed (AES-256-GCM) question token. The client holds it while the question is shown,
 * but cannot read the answer or forge a different one.
 */
export type QuestionPayload = {
  v: 1;
  qid: string;
  uid: string;
  sid: string;
  fid: string; // correct family id
  iid: string; // image id
  angle: Angle;
  opts: string[]; // option family ids in display order
  exposure: Exposure;
  conditions: Conditions;
  iat: number;
};

function key(): Buffer {
  const secret = process.env.QUESTION_TOKEN_SECRET ?? process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("QUESTION_TOKEN_SECRET is not set");
  return crypto.createHash("sha256").update(secret).digest();
}

export function sealQuestion(payload: QuestionPayload): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export function openQuestion(token: string): QuestionPayload | null {
  try {
    const raw = Buffer.from(token, "base64url");
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const body = raw.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
    const payload = JSON.parse(json) as QuestionPayload;
    return payload.v === 1 ? payload : null;
  } catch {
    return null;
  }
}
