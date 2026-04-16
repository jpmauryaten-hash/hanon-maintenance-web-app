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

export async function ensureMaintenanceScheduleTypeColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "maintenance_type" text;
  `);
}

export async function ensureMaintenanceScheduleChecksheetColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "checksheet_path" text;
  `);
}

export async function ensureMaintenanceScheduleCompletionColumns(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "completion_remark" text;
  `);

  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "completion_attachment_path" text;
  `);

  await db.execute(sql`
    ALTER TABLE "maintenance_schedules"
    ADD COLUMN IF NOT EXISTS "previous_scheduled_date" date;
  `);
}

export async function ensureMaintenanceScheduleHistoryTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "maintenance_schedule_history" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "schedule_id" uuid NOT NULL REFERENCES "maintenance_schedules"("id") ON DELETE CASCADE,
      "previous_scheduled_date" date NOT NULL,
      "new_scheduled_date" date NOT NULL,
      "reason" text,
      "changed_by_id" varchar REFERENCES "users"("id"),
      "created_at" timestamp DEFAULT now()
    );
  `);

  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS "maintenance_schedule_history_schedule_id_idx"
    ON "maintenance_schedule_history" ("schedule_id");
  `);
}

export async function ensureBreakdownsProblemDescriptionColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "breakdowns"
    ADD COLUMN IF NOT EXISTS "problem_description" text;
  `);
}

export async function ensureBreakdownsDeletedAtColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "breakdowns"
    ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
  `);
}

export async function ensureBreakdownsClosedDateColumn(): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "breakdowns"
    ADD COLUMN IF NOT EXISTS "closed_date" text;
  `);
}

export async function ensureMasterDataAuditColumns(): Promise<void> {
  const tables = ["lines", "sub_lines", "machines", "employees", "problem_types"];

  for (const table of tables) {
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "created_by" varchar REFERENCES "users"("id");`));
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "created_at" timestamp;`));
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updated_by" varchar REFERENCES "users"("id");`));
    await db.execute(sql.raw(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "updated_at" timestamp;`));
    await db.execute(sql.raw(`
      UPDATE "${table}"
      SET "created_by" = (
        SELECT "id" FROM "users" WHERE lower("role") = 'admin' ORDER BY "id" LIMIT 1
      )
      WHERE "created_by" IS NULL
        AND EXISTS (SELECT 1 FROM "users" WHERE lower("role") = 'admin');
    `));
  }
}

export async function ensureCapaCategoriesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "capa_categories" (
      "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      "name" text NOT NULL UNIQUE,
      "created_by" varchar REFERENCES "users"("id"),
      "created_at" timestamp DEFAULT now(),
      "updated_by" varchar REFERENCES "users"("id"),
      "updated_at" timestamp
    );
  `);

  const defaultCategories = [
    "Design Faults",
    "Lack of Preventive Maintenance",
    "Previous Quick Fix",
    "Incorrect Production Operation",
  ];

  for (const name of defaultCategories) {
    await db.execute(sql`
      INSERT INTO "capa_categories" ("name")
      VALUES (${name})
      ON CONFLICT ("name") DO NOTHING;
    `);
  }
}
