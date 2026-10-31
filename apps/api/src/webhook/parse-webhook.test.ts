import { describe, expect, it } from "vitest";
import { parseWebhook } from "./parse-webhook";

describe("parseWebhook", () => {
  it("reads the execution id and status from a Bolna execution body", () => {
    expect(parseWebhook({ id: "abc", status: "completed", transcript: "user: hi" })).toEqual({
      executionId: "abc",
      status: "completed",
      payload: { id: "abc", status: "completed", transcript: "user: hi" },
    });
  });

  it("accepts execution_id when id is absent", () => {
    expect(parseWebhook({ execution_id: "xyz", status: "ringing" }).executionId).toBe("xyz");
  });
});
