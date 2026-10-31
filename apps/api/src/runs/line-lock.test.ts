import { describe, expect, it } from "vitest";
import { lineIsBusy } from "./line-lock";

const now = Date.parse("2026-10-31T09:00:00.000Z");

describe("lineIsBusy", () => {
  it("is free when nobody holds the line", () => {
    expect(lineIsBusy({ lockRunId: null, lockAt: null, runStatus: null, now, claimRunId: "b" })).toBe(false);
  });

  it("stays busy for the whole run, including while a call is connected", () => {
    expect(
      lineIsBusy({
        lockRunId: "a",
        lockAt: new Date(now - 30_000),
        runStatus: "running",
        now,
        claimRunId: "b",
      }),
    ).toBe(true);
  });

  it("stays busy while the judge is still scoring", () => {
    expect(
      lineIsBusy({
        lockRunId: "a",
        lockAt: new Date(now - 4 * 60_000),
        runStatus: "scoring",
        now,
        claimRunId: "b",
      }),
    ).toBe(true);
  });

  it("is free once that run is done", () => {
    expect(
      lineIsBusy({
        lockRunId: "a",
        lockAt: new Date(now - 30_000),
        runStatus: "done",
        now,
        claimRunId: "b",
      }),
    ).toBe(false);
  });

  it("is free when the same run claims again", () => {
    expect(
      lineIsBusy({
        lockRunId: "a",
        lockAt: new Date(now),
        runStatus: "running",
        now,
        claimRunId: "a",
      }),
    ).toBe(false);
  });

  it("drops a lock that has sat for half an hour", () => {
    expect(
      lineIsBusy({
        lockRunId: "a",
        lockAt: new Date(now - 31 * 60_000),
        runStatus: "running",
        now,
        claimRunId: "b",
      }),
    ).toBe(false);
  });
});
