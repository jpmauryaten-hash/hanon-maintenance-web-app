import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  role: text("role").notNull().default("viewer"), // admin, supervisor, engineer, viewer
});

export const employees = pgTable("employees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  department: text("department"),
  role: text("role"),
});

export const lines = pgTable("lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const subLines = pgTable("sub_lines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  lineId: varchar("line_id").references(() => lines.id),
});

export const machines = pgTable("machines", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  lineId: varchar("line_id").references(() => lines.id),
  subLineId: varchar("sub_line_id").references(() => subLines.id),
  type: text("type"),
});

export const problemTypes = pgTable("problem_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const breakdowns = pgTable("breakdowns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  date: text("date").notNull(),
  shift: text("shift").notNull(), // A, B, C
  lineId: varchar("line_id").notNull().references(() => lines.id),
  subLineId: varchar("sub_line_id").references(() => subLines.id),
  machineId: varchar("machine_id").notNull().references(() => machines.id),
  problemTypeId: varchar("problem_type_id").notNull().references(() => problemTypes.id),
  priority: text("priority").notNull(), // High, Medium, Low
  actionTaken: text("action_taken"),
  rootCause: text("root_cause"),
  startTime: text("start_time").notNull(),
  finishTime: text("finish_time"),
  totalMinutes: integer("total_minutes"),
  majorContribution: text("major_contribution"),
  majorContributionTime: integer("major_contribution_time"),
  attendById: varchar("attend_by_id").notNull().references(() => employees.id),
  closedById: varchar("closed_by_id").references(() => employees.id),
  remark: text("remark"),
  status: text("status").notNull().default("open"), // open, closed, pending
  // CAPA fields - activated when priority=High and totalMinutes>=45
  capaRequired: text("capa_required").default("no"), // yes, no
  capaCorrectiveAction: text("capa_corrective_action"),
  capaPreventiveAction: text("capa_preventive_action"),
  capaCompletedById: varchar("capa_completed_by_id").references(() => employees.id),
  capaCompletionDate: text("capa_completion_date"),
  capaVerification: text("capa_verification"),
  createdById: varchar("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
});

export const insertEmployeeSchema = createInsertSchema(employees).omit({
  id: true,
});

export const insertLineSchema = createInsertSchema(lines).omit({
  id: true,
});

export const insertSubLineSchema = createInsertSchema(subLines).omit({
  id: true,
});

export const insertMachineSchema = createInsertSchema(machines).omit({
  id: true,
});

export const insertProblemTypeSchema = createInsertSchema(problemTypes).omit({
  id: true,
});

export const insertBreakdownSchema = createInsertSchema(breakdowns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Select types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;

export type Line = typeof lines.$inferSelect;
export type InsertLine = z.infer<typeof insertLineSchema>;

export type SubLine = typeof subLines.$inferSelect;
export type InsertSubLine = z.infer<typeof insertSubLineSchema>;

export type Machine = typeof machines.$inferSelect;
export type InsertMachine = z.infer<typeof insertMachineSchema>;

export type ProblemType = typeof problemTypes.$inferSelect;
export type InsertProblemType = z.infer<typeof insertProblemTypeSchema>;

export type Breakdown = typeof breakdowns.$inferSelect;
export type InsertBreakdown = z.infer<typeof insertBreakdownSchema>;
