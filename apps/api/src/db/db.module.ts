import { Global, Module } from "@nestjs/common";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export const DB = Symbol("DB");
export type Database = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DB,
      useFactory: () => {
        const client = postgres(env.databaseUrl, { max: 5 });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DB],
})
export class DbModule {}
