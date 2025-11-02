import { sql } from "drizzle-orm";
import { db } from "./db";

export async function ensureMaintenanceYearlyPlansTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "maintenance_yearly_plans" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "machine_id" varchar NOT NULL REFERENCES "machines"("id"),
      "plan_year" integer NOT NULL,
      "frequency" text,
      "jan" text,
      "feb" text,
      "mar" text,
      "apr" text,
      "may" text,
      "jun" text,
      "jul" text,
      "aug" text,
      "sep" text,
      "oct" text,
      "nov" text,
      "dec" text,
      "created_at" timestamp DEFAULT now(),
      "updated_at" timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS "maintenance_yearly_plans_machine_year_idx"
    ON "maintenance_yearly_plans" ("machine_id", "plan_year");
  `);
}

export async function ensureMaintenanceScheduleShiftColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "shift" text;
  `);
}
