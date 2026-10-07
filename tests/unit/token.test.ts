import { describe, expect, it } from "vitest";
import { openQuestion, sealQuestion, type QuestionPayload } from "@/lib/quiz/token";

const payload: QuestionPayload = {
  v: 1, qid: "q1", uid: "u1", sid: "s1", fid: "f-16", iid: "f-16-abc", angle: "side",
  opts: ["f-16", "f-35", "f-22", "fa-18"], exposure: "unlimited", conditions: "clear", iat: 123,
};

describe("question token", () => {
  it("round-trips", () => expect(openQuestion(sealQuestion(payload))).toEqual(payload));
  it("does not leak the answer in plaintext", () => {
    const t = sealQuestion(payload);
    expect(Buffer.from(t, "base64url").toString("utf8")).not.toContain("f-16");
  });
  it("rejects tampering", () => {
    const t = sealQuestion(payload);
    const bytes = Buffer.from(t, "base64url");
    bytes[bytes.length - 1] ^= 0xff;
    expect(openQuestion(bytes.toString("base64url"))).toBeNull();
  });
  it("rejects garbage", () => expect(openQuestion("not-a-token")).toBeNull());
});
