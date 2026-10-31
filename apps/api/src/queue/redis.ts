import Redis from "ioredis";
import { env } from "../env";

/** BullMQ needs maxRetriesPerRequest null, and a separate client for the queue and the worker. */
export function newRedis() {
  const url = new URL(env.redisUrl);
  return new Redis({
    host: url.hostname,
    port: Number(url.port || 6379),
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  });
}
