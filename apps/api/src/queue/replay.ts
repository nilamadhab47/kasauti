/** A completed or failed job id is kept, and BullMQ will not run that id again. Drop it and add a fresh one. */
export function replayFinishedJob(state: string): boolean {
  return state === "completed" || state === "failed";
}
