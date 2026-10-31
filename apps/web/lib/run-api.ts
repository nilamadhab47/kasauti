/** The Kasauti backend (NestJS). Server-side only; the browser talks to /api/run proxies. */
export const RUN_API_BASE = process.env.KASAUTI_API_URL?.trim() || "http://127.0.0.1:3001";

/** Fixture replays, one per selected caller, cycled so any set is repeatable with no paid call. */
export const DEMO_FIXTURES = [
  "fixtures/test-b-9581a1ff.json",
  "fixtures/test-b-32ea6d7d.json",
  "fixtures/test-b-3ee2277b.json",
];

/** A number Bolna is allowed to dial. Fixture runs never dial, but the API still checks it. */
export const FIXTURE_PHONE = "+919354509697";
