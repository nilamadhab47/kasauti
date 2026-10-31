import { writeSync } from "node:fs";

/** Write one line straight to stdout. Railway never sees buffered console.log after boot. */
export function logLine(message: string): void {
  writeSync(1, `${new Date().toISOString()} ${message}\n`);
}
