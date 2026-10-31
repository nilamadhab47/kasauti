import { describe, expect, it } from "vitest";
import { replayFinishedJob } from "./replay";

describe("replayFinishedJob", () => {
  it("replays a job id that already finished, and leaves a live one alone", () => {
    expect(replayFinishedJob("completed")).toBe(true);
    expect(replayFinishedJob("failed")).toBe(true);
    expect(replayFinishedJob("active")).toBe(false);
    expect(replayFinishedJob("waiting")).toBe(false);
    expect(replayFinishedJob("delayed")).toBe(false);
  });
});
