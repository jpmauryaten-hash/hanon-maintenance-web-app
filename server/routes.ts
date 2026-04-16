import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { passport, isAuthenticated, hasRole } from "./auth";
import {
  users,
  breakdowns,
  lines,
  subLines,
  machines,
  problemTypes,
  capaCategories,
  employees,
  maintenanceSchedules,
  maintenanceScheduleHistory,
  maintenanceYearlyPlans,
  type InsertMaintenanceYearlyPlan,
} from "@shared/schema";
import { insertBreakdownSchema } from "@shared/schema";
import { eq, and, sql, inArray, asc, lte, gte, desc, isNull, isNotNull } from "drizzle-orm";
import bcrypt from "bcrypt";
import { startMaintenanceScheduler, sendMaintenanceCompletionNotification } from "./maintenance-scheduler";
import multer, { type FileFilterCallback } from "multer";
import { randomBytes } from "crypto";
import { promises as fs } from "fs";
import path from "path";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to sanitize user object (remove password)
  const sanitizeUser = (user: any) => {
    const { password, ...safeUser } = user;
    return safeUser;
  };

  const toDateString = (value: unknown): string | null => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value.toISOString().split("T")[0];
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const tIndex = trimmed.indexOf("T");
      return tIndex === -1 ? trimmed : trimmed.slice(0, tIndex);
    }
    return null;
  };

  const getQueryValue = (value: string | string[] | undefined): string | null => {
    if (Array.isArray(value)) {
      return value.length > 0 ? String(value[0]) : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  };

  const sanitizeDateParam = (value: string | null): string | null => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  };

  const parseMinutesFromTime = (input: string | null | undefined): number | null => {
    if (typeof input !== "string") {
      return null;
    }
    const trimmed = input.trim();
    if (!trimmed) {
      return null;
    }
    const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
    if (!match) {
      return null;
    }
    const hours = Number.parseInt(match[1], 10);
    const minutes = Number.parseInt(match[2], 10);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
      return null;
    }
    return hours * 60 + minutes;
  };

  const toDateInstance = (value: unknown): Date | null => {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  };

  const parseYearParamValue = (value: string | null): number | null => {
    if (!value) {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed) || parsed < 1900 || parsed > 9999) {
      return null;
    }
    return parsed;
  };

  const normalizeText = (value: unknown): string => {
    if (typeof value !== "string") {
      return "";
    }
    return value.trim();
  };

  const toNullableText = (value: unknown): string | null => {
    const trimmed = normalizeText(value);
    return trimmed.length > 0 ? trimmed : null;
  };

  const normalizeUptimeInput = (value: unknown): number | null => {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 ? value : null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) {
        return null;
      }
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
    }
    return null;
  };

  const derivePlanStatus = (
    scheduledDateValue: unknown,
    completedAtValue: unknown,
  ): "Planned" | "Completed" | "Pending" | "Delayed" => {
    const scheduledDate = toDateInstance(scheduledDateValue);
    const completedAt = toDateInstance(completedAtValue);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (completedAt) {
      if (scheduledDate && completedAt.getTime() > scheduledDate.getTime()) {
        return "Delayed";
      }
      return "Completed";
    }

    if (!scheduledDate) {
      return "Planned";
    }

    const scheduledTime = scheduledDate.getTime();
    const todayTime = today.getTime();

    if (scheduledTime > todayTime) {
      return "Planned";
    }

    if (scheduledTime < todayTime) {
      return "Delayed";
    }

    return "Pending";
  };

  const computeBreakdownDurationMinutes = (
    startTime?: string | null,
    finishTime?: string | null,
    storedMinutes?: number | null,
  ): number | null => {
    if (typeof storedMinutes === "number" && Number.isFinite(storedMinutes) && storedMinutes >= 0) {
      return storedMinutes;
    }
    const startMinutes = parseMinutesFromTime(startTime);
    const finishMinutes = parseMinutesFromTime(finishTime);
    if (startMinutes == null || finishMinutes == null) {
      return null;
    }
    const diff = finishMinutes - startMinutes;
    return diff >= 0 ? diff : null;
  };

  const formatMinutesAsDuration = (minutes: number | null): string | null => {
    if (minutes == null || !Number.isFinite(minutes)) {
      return null;
    }
    const safeMinutes = Math.max(0, Math.floor(minutes));
    const hours = Math.floor(safeMinutes / 60);
    const remainingMinutes = safeMinutes % 60;
    const hoursPart = hours.toString().padStart(2, "0");
    const minutesPart = remainingMinutes.toString().padStart(2, "0");
    return `${hoursPart}:${minutesPart}`;
  };

  type RescheduleHistoryEntry = {
    previousScheduledDate: string;
    newScheduledDate: string;
    reason: string | null;
    changedAt: string | null;
    changedById: string | null;
  };

  const fetchRescheduleHistoryMap = async (
    scheduleIds: string[],
  ): Promise<Map<string, RescheduleHistoryEntry[]>> => {
    const historyMap = new Map<string, RescheduleHistoryEntry[]>();
    if (scheduleIds.length === 0) {
      return historyMap;
    }

    const rows = await db
      .select({
        scheduleId: maintenanceScheduleHistory.scheduleId,
        previousScheduledDate: maintenanceScheduleHistory.previousScheduledDate,
        newScheduledDate: maintenanceScheduleHistory.newScheduledDate,
        reason: maintenanceScheduleHistory.reason,
        changedById: maintenanceScheduleHistory.changedById,
        createdAt: maintenanceScheduleHistory.createdAt,
      })
      .from(maintenanceScheduleHistory)
      .where(inArray(maintenanceScheduleHistory.scheduleId, scheduleIds))
      .orderBy(
        asc(maintenanceScheduleHistory.previousScheduledDate),
        asc(maintenanceScheduleHistory.createdAt),
      );

    for (const row of rows) {
      const previousScheduledDate = toDateString(row.previousScheduledDate);
      const newScheduledDate = toDateString(row.newScheduledDate);
      if (!previousScheduledDate || !newScheduledDate) {
        continue;
      }

      const entry: RescheduleHistoryEntry = {
        previousScheduledDate,
        newScheduledDate,
        reason: typeof row.reason === "string" && row.reason.trim().length > 0 ? row.reason.trim() : null,
        changedAt:
          row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt ?? null,
        changedById: typeof row.changedById === "string" ? row.changedById : null,
      };

      const list = historyMap.get(row.scheduleId) ?? [];
      list.push(entry);
      historyMap.set(row.scheduleId, list);
    }

    historyMap.forEach((list) => {
      list.sort((a, b) => {
        if (a.previousScheduledDate === b.previousScheduledDate) {
          return (a.changedAt ?? "").localeCompare(b.changedAt ?? "");
        }
        return a.previousScheduledDate.localeCompare(b.previousScheduledDate);
      });
    });

    return historyMap;
  };

  const fetchRescheduleHistoryForId = async (scheduleId: string): Promise<RescheduleHistoryEntry[]> => {
    if (!scheduleId) {
      return [];
    }
    const historyMap = await fetchRescheduleHistoryMap([scheduleId]);
    return historyMap.get(scheduleId) ?? [];
  };

  const CHECKSHEET_DIR = path.join(process.cwd(), "uploads", "checksheets");
  const COMPLETION_DIR = path.join(process.cwd(), "uploads", "completion-docs");
  const allowedChecksheetExtensions = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx"]);
  const allowedCompletionExtensions = new Set([
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".jpg",
    ".jpeg",
    ".png",
  ]);
  const checksheetUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!allowedChecksheetExtensions.has(ext)) {
        return cb(new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX"));
      }
      cb(null, true);
    },
  });
  const completionUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      if (!allowedCompletionExtensions.has(ext)) {
        return cb(new Error("Unsupported file type. Allowed: PDF, DOC, DOCX, XLS, XLSX, JPG, JPEG, PNG"));
      }
      cb(null, true);
    },
  });

  const validShiftCodes = new Set(["A", "B", "C", "G"]);
  const normalizeShift = (value: unknown) => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) {
      return null;
    }
    return validShiftCodes.has(trimmed) ? trimmed : null;
  };

  const maintenanceTypeLookup = new Map(
    ["Preventive", "Predictive", "Overhauling"].map((label) => [label.toLowerCase(), label]),
  );
  const defaultMaintenanceType = "Preventive";
  const maintenanceTypeValidationMessage =
    "maintenanceType must be Preventive, Predictive, or Overhauling";
  const normalizeMaintenanceType = (value: unknown): string | null => {
    if (typeof value !== "string") {
      return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const normalized = maintenanceTypeLookup.get(trimmed.toLowerCase());
    return normalized ?? null;
  };

  const formatMaintenanceSchedule = (schedule: any) => {
    if (!schedule) {
      return schedule;
    }

    const storedMachineCode = schedule.machineCodeStored ?? null;
    const derivedMachineCode = schedule.machineCodeDerived ?? schedule.machineCodeFallback ?? schedule.machineCode ?? null;
    const machineCode = storedMachineCode ?? derivedMachineCode ?? null;

    const result = { ...schedule, machineCode };
    delete result.machineCodeStored;
    delete result.machineCodeDerived;
    delete result.machineCodeFallback;
    result.checksheetPath = schedule.checksheetPath ?? null;
    result.completionRemark = schedule.completionRemark ?? null;
    result.completionAttachmentPath = schedule.completionAttachmentPath ?? null;
    result.previousScheduledDate = schedule.previousScheduledDate ?? null;
    result.machineType = schedule.machineType ?? null;
    result.maintenanceType = schedule.maintenanceType ?? null;
    result.rescheduleHistory = Array.isArray(schedule.rescheduleHistory) ? schedule.rescheduleHistory : [];
    return result;
  };

  const toClientSchedule = (schedule: any, history: RescheduleHistoryEntry[] = []) =>
    formatMaintenanceSchedule({
      ...schedule,
      rescheduleHistory: history,
    });

  // Auth routes
  app.post("/api/auth/login", passport.authenticate("local"), (req, res) => {
    res.json({ user: sanitizeUser(req.user) });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", isAuthenticated, (req, res) => {
    res.json({ user: sanitizeUser(req.user) });
  });

  // Master data routes (read-only for most users)
  app.get("/api/lines", isAuthenticated, async (req, res) => {
    try {
      const allLines = await db.select().from(lines);
      res.json(allLines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lines" });
    }
  });

  app.get("/api/sub-lines", isAuthenticated, async (req, res) => {
    try {
      const allSubLines = await db.select().from(subLines);
      res.json(allSubLines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sub lines" });
    }
  });

  app.get("/api/machines", isAuthenticated, async (req, res) => {
    try {
      const allMachines = await db.select().from(machines);
      res.json(allMachines);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch machines" });
    }
  });

  app.get("/api/machines/breakdown-usage", isAuthenticated, async (req, res) => {
    try {
      const rows = await db
        .select({
          id: breakdowns.id,
          machineId: breakdowns.machineId,
          date: breakdowns.date,
          shift: breakdowns.shift,
          status: breakdowns.status,
          problemDescription: breakdowns.problemDescription,
          totalMinutes: breakdowns.totalMinutes,
        })
        .from(breakdowns)
        .where(isNull(breakdowns.deletedAt))
        .orderBy(desc(breakdowns.date), desc(breakdowns.startTime));

      const usage = rows.reduce<Record<string, typeof rows>>((acc, row) => {
        if (!acc[row.machineId]) {
          acc[row.machineId] = [];
        }
        acc[row.machineId].push(row);
        return acc;
      }, {});

      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch machine breakdown usage" });
    }
  });

  app.get("/api/problem-types", isAuthenticated, async (req, res) => {
    try {
      const allProblemTypes = await db.select().from(problemTypes);
      res.json(allProblemTypes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch problem types" });
    }
  });

  app.get("/api/employees", isAuthenticated, async (req, res) => {
    try {
      const allEmployees = await db.select().from(employees);
      res.json(allEmployees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
    }
  });

  app.get("/api/capa-categories", isAuthenticated, async (_req, res) => {
    try {
      const allCapaCategories = await db
        .select()
        .from(capaCategories)
        .orderBy(asc(capaCategories.name));
      res.json(allCapaCategories);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CAPA categories" });
    }
  });

  // Master data mutations (admin)
  app.post("/api/master-data/bulk", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const records = Array.isArray(req.body?.records) ? req.body.records : null;
      if (!records || records.length === 0) {
        return res.status(400).json({ error: "No records provided" });
      }

      type BulkMasterDataRecord = {
        lineName: string;
        subLineName: string;
        machineCode: string | null;
        machineName: string;
        maintenanceFrequency: string | null;
        pmPlanYear: string | null;
        uptime: number | null;
        machineType: string | null;
      };

      const sanitized: BulkMasterDataRecord[] = records.map((record: any) => ({
        lineName: normalizeText(record?.lineName),
        subLineName: normalizeText(record?.subLineName),
        machineCode: toNullableText(record?.machineCode),
        machineName: normalizeText(record?.machineName),
        maintenanceFrequency: toNullableText(record?.maintenanceFrequency),
        pmPlanYear: toNullableText(record?.pmPlanYear),
        uptime: normalizeUptimeInput(record?.uptime),
        machineType: toNullableText(record?.machineType),
      }));

      const invalidMachineRows = sanitized.filter(
        (record) => record.machineName && !record.subLineName,
      );
      if (invalidMachineRows.length > 0) {
        return res.status(400).json({
          error: "Every machine row must include a Sub Line Name. Please update the file and try again.",
        });
      }

      const missingMachineCodeRows = sanitized.filter(
        (record) => record.machineName && !record.machineCode,
      );
      if (missingMachineCodeRows.length > 0) {
        return res.status(400).json({
          error: "Each machine row must include a Machine Code. Please update the file and try again.",
        });
      }

      const summary = {
        createdLines: 0,
        createdSubLines: 0,
        createdMachines: 0,
        updatedMachines: 0,
      };

      await db.transaction(async (tx) => {
        const existingLines = await tx.select().from(lines);
        const existingSubLines = await tx.select().from(subLines);
        const existingMachines = await tx.select().from(machines);

        const lineByName = new Map(
          existingLines.map((line) => [line.name.trim().toLowerCase(), line]),
        );
        const subLineByKey = new Map(
          existingSubLines.map((subLine) => [
            `${subLine.lineId ?? ""}::${subLine.name.trim().toLowerCase()}`,
            subLine,
          ]),
        );
        const machineByCode = new Map(
          existingMachines
            .filter((machine) => machine.code)
            .map((machine) => [String(machine.code).trim().toUpperCase(), machine]),
        );
        for (const record of sanitized) {
          if (!record.lineName) {
            continue;
          }

          const lineKey = record.lineName.toLowerCase();
          let line = lineByName.get(lineKey);
          if (!line) {
            const [created] = await tx
              .insert(lines)
              .values({
                name: record.lineName,
                createdBy: userId,
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null,
              })
              .returning();
            line = created;
            lineByName.set(lineKey, created);
            summary.createdLines += 1;
          }

          let subLine = null as (typeof subLines.$inferSelect) | null;
          if (record.subLineName) {
            const subLineKey = `${line.id}::${record.subLineName.toLowerCase()}`;
            subLine = subLineByKey.get(subLineKey) ?? null;
            if (!subLine) {
              const [created] = await tx
                .insert(subLines)
                .values({
                  name: record.subLineName,
                  lineId: line.id,
                  createdBy: userId,
                  createdAt: new Date(),
                  updatedBy: null,
                  updatedAt: null,
                })
                .returning();
              subLine = created;
              subLineByKey.set(subLineKey, created);
              summary.createdSubLines += 1;
            }
          }

          if (!record.machineName) {
            continue;
          }
          if (!subLine) {
            throw new Error(
              "Every machine row must include a Sub Line Name. Please update the file and try again.",
            );
          }

          const machineCode = record.machineCode ? record.machineCode.trim().toUpperCase() : null;
          const machine = machineCode ? machineByCode.get(machineCode) : undefined;

          if (!machine) {
            const [created] = await tx
              .insert(machines)
              .values({
                name: record.machineName,
                code: machineCode,
                lineId: line.id,
                subLineId: subLine.id,
                type: record.machineType,
                maintenanceFrequency: record.maintenanceFrequency,
                pmPlanYear: record.pmPlanYear,
                uptime: record.uptime,
                createdBy: userId,
                createdAt: new Date(),
                updatedBy: null,
                updatedAt: null,
              })
              .returning();
            if (machineCode) {
              machineByCode.set(machineCode, created);
            }
            summary.createdMachines += 1;
            continue;
          }

          const [updated] = await tx
            .update(machines)
            .set({
              name: record.machineName,
              code: machineCode,
              lineId: line.id,
              subLineId: subLine.id,
              type: record.machineType,
              maintenanceFrequency: record.maintenanceFrequency,
              pmPlanYear: record.pmPlanYear,
              uptime: record.uptime,
              updatedBy: userId,
              updatedAt: new Date(),
            })
            .where(eq(machines.id, machine.id))
            .returning();

          if (updated) {
            if (machineCode) {
              machineByCode.set(machineCode, updated);
            }
            summary.updatedMachines += 1;
          }
        }
      });

      res.json({ summary });
    } catch (error: any) {
      const message = error?.message || "Failed to import master data";
      console.error("Failed to import master data:", error);
      res.status(400).json({ error: message });
    }
  });

  app.post("/api/lines", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const name = normalizeText(req.body?.name);
      const description = toNullableText(req.body?.description);

      if (!name) {
        return res.status(400).json({ error: "Line name is required" });
      }

      const [line] = await db
        .insert(lines)
        .values({ name, description, createdBy: userId, createdAt: new Date(), updatedBy: null, updatedAt: null })
        .returning();
      res.json(line);
    } catch (error) {
      console.error("Failed to create line:", error);
      res.status(400).json({ error: "Failed to create line" });
    }
  });

  app.put("/api/lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const name = normalizeText(req.body?.name);
      const description = toNullableText(req.body?.description);

      if (!name) {
        return res.status(400).json({ error: "Line name is required" });
      }

      const [line] = await db
        .update(lines)
        .set({ name, description, updatedBy: userId, updatedAt: new Date() })
        .where(eq(lines.id, id))
        .returning();

      if (!line) {
        return res.status(404).json({ error: "Line not found" });
      }

      res.json(line);
    } catch (error) {
      console.error("Failed to update line:", error);
      res.status(400).json({ error: "Failed to update line" });
    }
  });

  app.delete("/api/lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const [existing] = await db
        .select({ id: lines.id })
        .from(lines)
        .where(eq(lines.id, id))
        .limit(1);

      if (!existing) {
        return res.status(404).json({ error: "Line not found" });
      }

      const [linkedSubLine] = await db
        .select({ id: subLines.id })
        .from(subLines)
        .where(eq(subLines.lineId, id))
        .limit(1);
      if (linkedSubLine) {
        return res.status(400).json({ error: "Cannot delete line while sub lines exist" });
      }

      const [linkedMachine] = await db
        .select({ id: machines.id })
        .from(machines)
        .where(eq(machines.lineId, id))
        .limit(1);
      if (linkedMachine) {
        return res.status(400).json({ error: "Cannot delete line while machines exist" });
      }

      await db.delete(lines).where(eq(lines.id, id));
      res.json({ message: "Line deleted" });
    } catch (error) {
      console.error("Failed to delete line:", error);
      res.status(500).json({ error: "Failed to delete line" });
    }
  });

  app.post("/api/sub-lines", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const name = normalizeText(req.body?.name);
      const lineId = normalizeText(req.body?.lineId);

      if (!name) {
        return res.status(400).json({ error: "Sub line name is required" });
      }
      if (!lineId) {
        return res.status(400).json({ error: "Parent line is required" });
      }

      const [line] = await db
        .select({ id: lines.id })
        .from(lines)
        .where(eq(lines.id, lineId))
        .limit(1);
      if (!line) {
        return res.status(400).json({ error: "Parent line not found" });
      }

      const [subLine] = await db
        .insert(subLines)
        .values({ name, lineId, createdBy: userId, createdAt: new Date(), updatedBy: null, updatedAt: null })
        .returning();
      res.json(subLine);
    } catch (error) {
      console.error("Failed to create sub line:", error);
      res.status(400).json({ error: "Failed to create sub line" });
    }
  });

  app.put("/api/sub-lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const name = normalizeText(req.body?.name);
      const lineId = normalizeText(req.body?.lineId);

      if (!name) {
        return res.status(400).json({ error: "Sub line name is required" });
      }
      if (!lineId) {
        return res.status(400).json({ error: "Parent line is required" });
      }

      const [line] = await db
        .select({ id: lines.id })
        .from(lines)
        .where(eq(lines.id, lineId))
        .limit(1);
      if (!line) {
        return res.status(400).json({ error: "Parent line not found" });
      }

      const [subLine] = await db
        .update(subLines)
        .set({ name, lineId, updatedBy: userId, updatedAt: new Date() })
        .where(eq(subLines.id, id))
        .returning();

      if (!subLine) {
        return res.status(404).json({ error: "Sub line not found" });
      }

      res.json(subLine);
    } catch (error) {
      console.error("Failed to update sub line:", error);
      res.status(400).json({ error: "Failed to update sub line" });
    }
  });

  app.delete("/api/sub-lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;

      const [existing] = await db
        .select({ id: subLines.id })
        .from(subLines)
        .where(eq(subLines.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Sub line not found" });
      }

      const [linkedMachine] = await db
        .select({ id: machines.id })
        .from(machines)
        .where(eq(machines.subLineId, id))
        .limit(1);
      if (linkedMachine) {
        return res.status(400).json({ error: "Cannot delete sub line while machines exist" });
      }

      await db.delete(subLines).where(eq(subLines.id, id));
      res.json({ message: "Sub line deleted" });
    } catch (error) {
      console.error("Failed to delete sub line:", error);
      res.status(500).json({ error: "Failed to delete sub line" });
    }
  });

  app.post("/api/machines", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const name = normalizeText(req.body?.name);
      const lineId = normalizeText(req.body?.lineId);
      const subLineId = normalizeText(req.body?.subLineId);
      const code = toNullableText(req.body?.code);
      const type = toNullableText(req.body?.type);
      const maintenanceFrequency = toNullableText(req.body?.maintenanceFrequency);
      const pmPlanYear = toNullableText(req.body?.pmPlanYear);
      const uptime = normalizeUptimeInput(req.body?.uptime);

      if (!name) {
        return res.status(400).json({ error: "Machine name is required" });
      }
      if (!lineId) {
        return res.status(400).json({ error: "Line is required" });
      }
      if (!subLineId) {
        return res.status(400).json({ error: "Sub line is required" });
      }

      const [line] = await db
        .select({ id: lines.id })
        .from(lines)
        .where(eq(lines.id, lineId))
        .limit(1);
      if (!line) {
        return res.status(400).json({ error: "Line not found" });
      }

      const [subLine] = await db
        .select({ id: subLines.id, parentLineId: subLines.lineId })
        .from(subLines)
        .where(eq(subLines.id, subLineId))
        .limit(1);
      if (!subLine) {
        return res.status(400).json({ error: "Sub line not found" });
      }
      if (subLine.parentLineId && subLine.parentLineId !== lineId) {
        return res.status(400).json({ error: "Sub line does not belong to the selected line" });
      }

      const [machine] = await db
        .insert(machines)
        .values({
          name,
          code: code ? code.toUpperCase() : null,
          lineId,
          subLineId,
          type,
          maintenanceFrequency,
          pmPlanYear,
          uptime,
          createdBy: userId,
          createdAt: new Date(),
          updatedBy: null,
          updatedAt: null,
        })
        .returning();

      res.json(machine);
    } catch (error) {
      console.error("Failed to create machine:", error);
      res.status(400).json({ error: "Failed to create machine" });
    }
  });

  app.put("/api/machines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const name = normalizeText(req.body?.name);
      const lineId = normalizeText(req.body?.lineId);
      const subLineId = normalizeText(req.body?.subLineId);
      const code = toNullableText(req.body?.code);
      const type = toNullableText(req.body?.type);
      const maintenanceFrequency = toNullableText(req.body?.maintenanceFrequency);
      const pmPlanYear = toNullableText(req.body?.pmPlanYear);
      const uptime = normalizeUptimeInput(req.body?.uptime);

      if (!name) {
        return res.status(400).json({ error: "Machine name is required" });
      }
      if (!lineId) {
        return res.status(400).json({ error: "Line is required" });
      }
      if (!subLineId) {
        return res.status(400).json({ error: "Sub line is required" });
      }

      const [line] = await db
        .select({ id: lines.id })
        .from(lines)
        .where(eq(lines.id, lineId))
        .limit(1);
      if (!line) {
        return res.status(400).json({ error: "Line not found" });
      }

      const [subLine] = await db
        .select({ id: subLines.id, parentLineId: subLines.lineId })
        .from(subLines)
        .where(eq(subLines.id, subLineId))
        .limit(1);
      if (!subLine) {
        return res.status(400).json({ error: "Sub line not found" });
      }
      if (subLine.parentLineId && subLine.parentLineId !== lineId) {
        return res.status(400).json({ error: "Sub line does not belong to the selected line" });
      }

      const [machine] = await db
        .update(machines)
        .set({
          name,
          code: code ? code.toUpperCase() : null,
          lineId,
          subLineId,
          type,
          maintenanceFrequency,
          pmPlanYear,
          uptime,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(machines.id, id))
        .returning();

      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }

      res.json(machine);
    } catch (error) {
      console.error("Failed to update machine:", error);
      res.status(400).json({ error: "Failed to update machine" });
    }
  });

  app.delete("/api/machines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;

      const [existing] = await db
        .select({ id: machines.id })
        .from(machines)
        .where(eq(machines.id, id))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ error: "Machine not found" });
      }

      const linkedBreakdowns = await db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          shift: breakdowns.shift,
          status: breakdowns.status,
          problemDescription: breakdowns.problemDescription,
          totalMinutes: breakdowns.totalMinutes,
        })
        .from(breakdowns)
        .where(and(eq(breakdowns.machineId, id), isNull(breakdowns.deletedAt)))
        .orderBy(desc(breakdowns.date), desc(breakdowns.startTime));

      if (linkedBreakdowns.length > 0) {
        return res.status(409).json({
          error: "Machine has associated breakdown entries and cannot be deleted.",
          breakdowns: linkedBreakdowns,
        });
      }

      await db.delete(machines).where(eq(machines.id, id));
      res.json({ message: "Machine deleted" });
    } catch (error) {
      console.error("Failed to delete machine:", error);
      res.status(500).json({ error: "Failed to delete machine" });
    }
  });

  app.get("/api/yearly-maintenance-plans", isAuthenticated, async (req, res) => {
    try {
      const yearParam = Array.isArray(req.query.year) ? req.query.year[0] : req.query.year;
      const currentYear = new Date().getFullYear();
      const parsedYear = yearParam && typeof yearParam === "string" && yearParam.trim().length > 0
        ? Number.parseInt(yearParam, 10)
        : currentYear;

      if (!Number.isFinite(parsedYear)) {
        return res.status(400).json({ error: "Invalid year parameter" });
      }

      const plans = await db
        .select({
          id: maintenanceYearlyPlans.id,
          machineId: maintenanceYearlyPlans.machineId,
          planYear: maintenanceYearlyPlans.planYear,
          frequency: maintenanceYearlyPlans.frequency,
          jan: maintenanceYearlyPlans.jan,
          feb: maintenanceYearlyPlans.feb,
          mar: maintenanceYearlyPlans.mar,
          apr: maintenanceYearlyPlans.apr,
          may: maintenanceYearlyPlans.may,
          jun: maintenanceYearlyPlans.jun,
          jul: maintenanceYearlyPlans.jul,
          aug: maintenanceYearlyPlans.aug,
          sep: maintenanceYearlyPlans.sep,
          oct: maintenanceYearlyPlans.oct,
          nov: maintenanceYearlyPlans.nov,
          dec: maintenanceYearlyPlans.dec,
          createdAt: maintenanceYearlyPlans.createdAt,
          updatedAt: maintenanceYearlyPlans.updatedAt,
          machineName: machines.name,
          machineCode: machines.code,
        })
        .from(maintenanceYearlyPlans)
        .leftJoin(machines, eq(maintenanceYearlyPlans.machineId, machines.id))
        .where(eq(maintenanceYearlyPlans.planYear, parsedYear));

      res.json(plans);
    } catch (error) {
      console.error("Failed to fetch yearly maintenance plans:", error);
      res.status(500).json({ error: "Failed to fetch yearly maintenance plans" });
    }
  });

  app.post(
    "/api/yearly-maintenance-plans",
    isAuthenticated,
    hasRole("Admin", "Supervisor"),
    async (req, res) => {
      try {
        const { year, plans } = req.body ?? {};
        const yearString = typeof year === "number" ? String(year) : year;
        const parsedYear =
          typeof yearString === "string" && yearString.trim().length > 0
            ? Number.parseInt(yearString, 10)
            : NaN;

        if (!Number.isFinite(parsedYear)) {
          return res.status(400).json({ error: "A valid year is required" });
        }

        if (!Array.isArray(plans)) {
          return res.status(400).json({ error: "Plans payload must be an array" });
        }

        const shiftOptions = new Set(["A", "B", "C", "G"]);
        const frequencyLookup = new Map(
          ["Monthly", "Quarterly", "Half Yearly", "Yearly"].map((value) => [
            value.toLowerCase(),
            value,
          ]),
        );
        const monthKeys = [
          "jan",
          "feb",
          "mar",
          "apr",
          "may",
          "jun",
          "jul",
          "aug",
          "sep",
          "oct",
          "nov",
          "dec",
        ] as const;

        const normalizeShiftOption = (value: unknown) => {
          if (typeof value !== "string") {
            return null;
          }
          const trimmed = value.trim().toUpperCase();
          if (trimmed.length === 0) {
            return null;
          }
          return shiftOptions.has(trimmed) ? trimmed : null;
        };

        const normalizeFrequency = (value: unknown) => {
          if (typeof value !== "string") {
            return null;
          }
          const trimmed = value.trim();
          if (trimmed.length === 0) {
            return null;
          }
          const normalized = frequencyLookup.get(trimmed.toLowerCase());
          return normalized ?? null;
        };

        const now = new Date();
        const records: InsertMaintenanceYearlyPlan[] = [];
        const deleteIds = new Set<string>();

        for (const plan of plans) {
          if (typeof plan !== "object" || plan === null) {
            continue;
          }

          const machineId =
            typeof (plan as any).machineId === "string"
              ? (plan as any).machineId.trim()
              : "";

          if (!machineId) {
            continue;
          }

          const record: InsertMaintenanceYearlyPlan = {
            machineId,
            planYear: parsedYear,
            frequency: normalizeFrequency((plan as any).frequency),
            jan: null,
            feb: null,
            mar: null,
            apr: null,
            may: null,
            jun: null,
            jul: null,
            aug: null,
            sep: null,
            oct: null,
            nov: null,
            dec: null,
          };

          for (const key of monthKeys) {
            record[key] = normalizeShiftOption((plan as any)[key]);
          }

          const hasContent =
            record.frequency !== null ||
            monthKeys.some((key) => record[key] !== null);

          if (!hasContent) {
            deleteIds.add(machineId);
            continue;
          }

          deleteIds.delete(machineId);
          records.push(record);
        }

        if (records.length === 0 && deleteIds.size === 0) {
          return res
            .status(400)
            .json({ error: "No valid yearly maintenance plan data to save" });
        }

        if (records.length > 0) {
          await db
            .insert(maintenanceYearlyPlans)
            .values(records)
            .onConflictDoUpdate({
              target: [maintenanceYearlyPlans.machineId, maintenanceYearlyPlans.planYear],
              set: {
                frequency: sql`excluded.frequency`,
                jan: sql`excluded.jan`,
                feb: sql`excluded.feb`,
                mar: sql`excluded.mar`,
                apr: sql`excluded.apr`,
                may: sql`excluded.may`,
                jun: sql`excluded.jun`,
                jul: sql`excluded.jul`,
                aug: sql`excluded.aug`,
                sep: sql`excluded.sep`,
                oct: sql`excluded.oct`,
                nov: sql`excluded.nov`,
                dec: sql`excluded.dec`,
                updatedAt: now,
              },
            });
        }

        if (deleteIds.size > 0) {
          await db
            .delete(maintenanceYearlyPlans)
            .where(
              and(
                eq(maintenanceYearlyPlans.planYear, parsedYear),
                inArray(maintenanceYearlyPlans.machineId, Array.from(deleteIds)),
              ),
            );
        }

        const updatedPlans = await db
          .select({
            id: maintenanceYearlyPlans.id,
            machineId: maintenanceYearlyPlans.machineId,
            planYear: maintenanceYearlyPlans.planYear,
            frequency: maintenanceYearlyPlans.frequency,
            jan: maintenanceYearlyPlans.jan,
            feb: maintenanceYearlyPlans.feb,
            mar: maintenanceYearlyPlans.mar,
            apr: maintenanceYearlyPlans.apr,
            may: maintenanceYearlyPlans.may,
            jun: maintenanceYearlyPlans.jun,
            jul: maintenanceYearlyPlans.jul,
            aug: maintenanceYearlyPlans.aug,
            sep: maintenanceYearlyPlans.sep,
            oct: maintenanceYearlyPlans.oct,
            nov: maintenanceYearlyPlans.nov,
            dec: maintenanceYearlyPlans.dec,
            createdAt: maintenanceYearlyPlans.createdAt,
            updatedAt: maintenanceYearlyPlans.updatedAt,
            machineName: machines.name,
            machineCode: machines.code,
          })
          .from(maintenanceYearlyPlans)
          .leftJoin(machines, eq(maintenanceYearlyPlans.machineId, machines.id))
          .where(eq(maintenanceYearlyPlans.planYear, parsedYear));

        res.json(updatedPlans);
      } catch (error) {
        console.error("Failed to save yearly maintenance plans:", error);
        res.status(500).json({ error: "Failed to save yearly maintenance plans" });
      }
    },
  );

  // Maintenance planner routes
  app.get("/api/maintenance-plans", isAuthenticated, hasRole("Admin", "Supervisor"), async (req, res) => {
    try {
      const schedules = await db
        .select({
          id: maintenanceSchedules.id,
          machineId: maintenanceSchedules.machineId,
          machineCodeStored: maintenanceSchedules.machineCode,
          machineCodeDerived: machines.code,
          scheduledDate: maintenanceSchedules.scheduledDate,
          shift: maintenanceSchedules.shift,
          status: maintenanceSchedules.status,
          maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
          maintenanceType: maintenanceSchedules.maintenanceType,
          notes: maintenanceSchedules.notes,
          emailRecipients: maintenanceSchedules.emailRecipients,
          emailTemplate: maintenanceSchedules.emailTemplate,
          checksheetPath: maintenanceSchedules.checksheetPath,
          completionRemark: maintenanceSchedules.completionRemark,
          completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
          previousScheduledDate: maintenanceSchedules.previousScheduledDate,
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
          machineType: machines.type,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id));

      const scheduleIds = schedules
        .map((schedule) => (typeof schedule.id === "string" ? schedule.id : null))
        .filter((id): id is string => Boolean(id));
      const historyMap = await fetchRescheduleHistoryMap(scheduleIds);

      res.json(
        schedules.map((schedule) =>
          toClientSchedule(schedule, schedule.id ? historyMap.get(schedule.id) ?? [] : []),
        ),
      );
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch maintenance plans" });
    }
  });

  app.post("/api/maintenance-plans", isAuthenticated, hasRole("Admin", "Supervisor"), async (req, res) => {
    try {
      const {
        machineId,
        scheduledDate,
        maintenanceFrequency,
        maintenanceType: requestedMaintenanceType,
        notes,
        emailRecipients,
        emailTemplate,
        machineCode: requestMachineCode,
        shift: requestedShift,
      } = req.body ?? {};

      if (!machineId || !scheduledDate) {
        return res.status(400).json({ error: "Machine and scheduled date are required" });
      }

      const [machine] = await db.select().from(machines).where(eq(machines.id, machineId)).limit(1);
      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }

      const parsedDate = new Date(scheduledDate);
      if (Number.isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: "Invalid scheduled date" });
      }

      const formattedDate = parsedDate.toISOString().split("T")[0];
      const trimmedRequestMachineCode = typeof requestMachineCode === "string" ? requestMachineCode.trim() : "";
      const finalMachineCode = trimmedRequestMachineCode || machine.code || null;

      const finalFrequency = (maintenanceFrequency || machine.maintenanceFrequency || "").trim();
      const finalShift = normalizeShift(requestedShift);
      if (!finalShift) {
        return res.status(400).json({ error: "Shift must be one of A, B, C, or G" });
      }
      let finalMaintenanceType = defaultMaintenanceType;
      if (requestedMaintenanceType !== undefined && requestedMaintenanceType !== null) {
        const normalizedMaintenanceType = normalizeMaintenanceType(requestedMaintenanceType);
        if (!normalizedMaintenanceType) {
          return res.status(400).json({
            error: maintenanceTypeValidationMessage,
          });
        }
        finalMaintenanceType = normalizedMaintenanceType;
      }

      const [created] = await db
        .insert(maintenanceSchedules)
        .values({
          machineId,
          scheduledDate: formattedDate,
          shift: finalShift,
          maintenanceFrequency: finalFrequency || null,
          maintenanceType: finalMaintenanceType,
          notes: notes?.trim() || null,
          emailRecipients: emailRecipients ? String(emailRecipients).trim() || null : null,
          emailTemplate: emailTemplate ? String(emailTemplate).trim() || null : null,
          preNotificationSent: false,
          createdById: (req.user as any)?.id ?? null,
        })
        .returning({ id: maintenanceSchedules.id });

      const [schedule] = await db
        .select({
          id: maintenanceSchedules.id,
          machineId: maintenanceSchedules.machineId,
          machineCodeStored: maintenanceSchedules.machineCode,
          machineCodeDerived: machines.code,
          scheduledDate: maintenanceSchedules.scheduledDate,
          shift: maintenanceSchedules.shift,
          status: maintenanceSchedules.status,
          maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
          maintenanceType: maintenanceSchedules.maintenanceType,
          notes: maintenanceSchedules.notes,
          emailRecipients: maintenanceSchedules.emailRecipients,
          emailTemplate: maintenanceSchedules.emailTemplate,
          checksheetPath: maintenanceSchedules.checksheetPath,
          completionRemark: maintenanceSchedules.completionRemark,
          completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
          previousScheduledDate: maintenanceSchedules.previousScheduledDate,
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
          machineType: machines.type,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .where(eq(maintenanceSchedules.id, created.id))
        .limit(1);

      if (!schedule) {
        return res.status(500).json({ error: "Failed to load maintenance schedule after creation" });
      }

      const historyEntries = schedule.id ? await fetchRescheduleHistoryForId(schedule.id) : [];
      res.json(toClientSchedule(schedule, historyEntries));
    } catch (error) {
      console.error("Failed to create maintenance plan:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to create maintenance plan";
      res.status(500).json({ error: message });
    }
  });

  app.put("/api/maintenance-plans/:id", isAuthenticated, hasRole("Admin", "Supervisor"), async (req, res) => {
    try {
      const { id } = req.params;
      const {
        scheduledDate,
        maintenanceFrequency,
        maintenanceType: requestedMaintenanceType,
        notes,
        status,
        emailRecipients,
        emailTemplate,
        machineCode: updatedMachineCode,
        shift: updatedShift,
      } = req.body ?? {};

      const [existingSchedule] = await db
        .select({
          scheduledDate: maintenanceSchedules.scheduledDate,
          previousScheduledDate: maintenanceSchedules.previousScheduledDate,
        })
        .from(maintenanceSchedules)
        .where(eq(maintenanceSchedules.id, id))
        .limit(1);

      if (!existingSchedule) {
        return res.status(404).json({ error: "Maintenance plan not found" });
      }

      const updates: Record<string, any> = { updatedAt: new Date() };
      let scheduledDateChanged = false;
      let formattedScheduledDate: string | null = null;
      const trimmedNotes = typeof notes === "string" ? notes.trim() : "";
      let historyPayload:
        | {
            scheduleId: string;
            previousScheduledDate: string;
            newScheduledDate: string;
            reason: string | null;
            changedById: string | null;
          }
        | null = null;

      if (scheduledDate) {
        const parsedDate = new Date(scheduledDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduled date" });
        }
        formattedScheduledDate = parsedDate.toISOString().split("T")[0];
        updates.scheduledDate = formattedScheduledDate;
        updates.preNotificationSent = false;

        if (existingSchedule.scheduledDate !== formattedScheduledDate) {
          scheduledDateChanged = true;
          updates.previousScheduledDate = existingSchedule.scheduledDate;
          if (existingSchedule.scheduledDate) {
            historyPayload = {
              scheduleId: id,
              previousScheduledDate: existingSchedule.scheduledDate,
              newScheduledDate: formattedScheduledDate,
              reason: trimmedNotes || null,
              changedById: typeof (req.user as any)?.id === "string" ? (req.user as any).id : null,
            };
          }
        }
      }

      if (maintenanceFrequency !== undefined) {
        const trimmed = String(maintenanceFrequency || "").trim();
        updates.maintenanceFrequency = trimmed || null;
      }

      if (scheduledDateChanged && trimmedNotes.length === 0) {
        return res.status(400).json({ error: "Provide a note explaining the date change" });
      }

      if (notes !== undefined) {
        updates.notes = trimmedNotes || null;
      }

      if (requestedMaintenanceType !== undefined) {
        const normalizedMaintenanceType = normalizeMaintenanceType(requestedMaintenanceType);
        if (!normalizedMaintenanceType) {
          return res.status(400).json({
            error: maintenanceTypeValidationMessage,
          });
        }
        updates.maintenanceType = normalizedMaintenanceType;
      }

      if (updatedMachineCode !== undefined) {
        const trimmedMachineCode = String(updatedMachineCode || "").trim();
        updates.machineCode = trimmedMachineCode || null;
      }

      if (emailRecipients !== undefined) {
        const trimmedRecipients = String(emailRecipients || "").trim();
        updates.emailRecipients = trimmedRecipients || null;
      }

      if (emailTemplate !== undefined) {
        const trimmedTemplate = String(emailTemplate || "").trim();
        updates.emailTemplate = trimmedTemplate || null;
      }

      if (updatedShift !== undefined) {
        const normalized = normalizeShift(updatedShift);
        if (!normalized) {
          return res.status(400).json({ error: "Shift must be one of A, B, C, or G" });
        }
        updates.shift = normalized;
      }

      if (status && typeof status === "string") {
        updates.status = status;
        if (status !== "completed") {
          updates.completedAt = null;
        }
      }

      const updated = await db.transaction(async (tx) => {
        const [updatedRow] = await tx
          .update(maintenanceSchedules)
          .set(updates)
          .where(eq(maintenanceSchedules.id, id))
          .returning({ id: maintenanceSchedules.id });

        if (!updatedRow) {
          return null;
        }

        if (scheduledDateChanged && historyPayload) {
          await tx.insert(maintenanceScheduleHistory).values(historyPayload);
        }

        return updatedRow;
      });

      if (!updated) {
        return res.status(404).json({ error: "Maintenance plan not found" });
      }

      const [schedule] = await db
        .select({
          id: maintenanceSchedules.id,
          machineId: maintenanceSchedules.machineId,
          machineCodeStored: maintenanceSchedules.machineCode,
          machineCodeDerived: machines.code,
          scheduledDate: maintenanceSchedules.scheduledDate,
          shift: maintenanceSchedules.shift,
          status: maintenanceSchedules.status,
          maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
          maintenanceType: maintenanceSchedules.maintenanceType,
          notes: maintenanceSchedules.notes,
          emailRecipients: maintenanceSchedules.emailRecipients,
          emailTemplate: maintenanceSchedules.emailTemplate,
          checksheetPath: maintenanceSchedules.checksheetPath,
          completionRemark: maintenanceSchedules.completionRemark,
          completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
          previousScheduledDate: maintenanceSchedules.previousScheduledDate,
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
          machineType: machines.type,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .where(eq(maintenanceSchedules.id, updated.id))
        .limit(1);

      if (!schedule) {
        return res.status(500).json({ error: "Failed to load maintenance schedule after creation" });
      }

      const historyEntries = schedule.id ? await fetchRescheduleHistoryForId(schedule.id) : [];
      res.json(toClientSchedule(schedule, historyEntries));
    } catch (error) {
      console.error("Failed to update maintenance plan:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to update maintenance plan";
      res.status(500).json({ error: message });
    }
  });

  app.post(
    "/api/maintenance-plans/bulk",
    isAuthenticated,
    hasRole("Admin", "Supervisor"),
    async (req, res) => {
      try {
        const records = Array.isArray(req.body?.records) ? req.body.records : null;
        if (!records || records.length === 0) {
          return res.status(400).json({ error: "No records provided" });
        }

        const sanitized = records.map((record: any) => ({
          machineName: normalizeText(record?.machineName),
          machineCode: toNullableText(record?.machineCode),
          scheduledDate: normalizeText(record?.scheduledDate),
          shift: normalizeText(record?.shift),
          emailRecipients: toNullableText(record?.emailRecipients),
        }));

        const invalidRows = sanitized.filter(
          (record) => !record.scheduledDate || !record.shift || (!record.machineName && !record.machineCode),
        );
        if (invalidRows.length > 0) {
          return res.status(400).json({
            error: "Each row requires Scheduled Date, Shift, and Machine Name or Machine Code.",
          });
        }

        const summary = { created: 0 };

        await db.transaction(async (tx) => {
          const existingMachines = await tx.select().from(machines);
          const machinesByCode = new Map<string, (typeof machines.$inferSelect)>();
          const machinesByName = new Map<string, (typeof machines.$inferSelect)>();
          for (const machine of existingMachines) {
            if (machine.code) {
              machinesByCode.set(machine.code.trim().toUpperCase(), machine);
            }
            machinesByName.set(machine.name.trim().toLowerCase(), machine);
          }

          for (const record of sanitized) {
            const codeKey = record.machineCode ? record.machineCode.trim().toUpperCase() : "";
            const nameKey = record.machineName ? record.machineName.trim().toLowerCase() : "";
            const machine =
              (codeKey ? machinesByCode.get(codeKey) : null) ??
              (nameKey ? machinesByName.get(nameKey) : null);

            if (!machine) {
              throw new Error(`Machine not found for ${record.machineCode || record.machineName}`);
            }

            const parsedDate = new Date(record.scheduledDate);
            if (Number.isNaN(parsedDate.getTime())) {
              throw new Error(`Invalid scheduled date for ${machine.name}`);
            }

            const formattedDate = parsedDate.toISOString().split("T")[0];
            const finalShift = normalizeShift(record.shift);
            if (!finalShift) {
              throw new Error(`Shift must be one of A, B, C, or G for ${machine.name}`);
            }

            const finalFrequency = (machine.maintenanceFrequency || "").trim();

            await tx.insert(maintenanceSchedules).values({
              machineId: machine.id,
              scheduledDate: formattedDate,
              shift: finalShift,
              maintenanceFrequency: finalFrequency || null,
              maintenanceType: defaultMaintenanceType,
              notes: null,
              emailRecipients: record.emailRecipients,
              emailTemplate: null,
              machineCode: machine.code || null,
              status: "scheduled",
            });

            summary.created += 1;
          }
        });

        res.json({ summary });
      } catch (error: any) {
        const message = error?.message || "Failed to bulk schedule maintenance";
        console.error("Failed to bulk schedule maintenance:", error);
        res.status(400).json({ error: message });
      }
    },
  );

  app.post(
    "/api/maintenance-plans/:id/complete",
    isAuthenticated,
    hasRole("Admin", "Supervisor"),
    (req, res, next) => {
      completionUpload.single("attachment")(req as any, res as any, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : "Failed to upload completion attachment";
          return res.status(400).json({ error: message });
        }
        next();
      });
    },
    async (req, res) => {
      const { id } = req.params;
      const remarkRaw = typeof req.body?.remark === "string" ? req.body.remark.trim() : "";
      if (remarkRaw.length === 0) {
        return res.status(400).json({ error: "Completion remark is required" });
      }

      const file = (req as any).file as { originalname?: string; buffer: Buffer } | undefined;
      if (!file) {
        return res.status(400).json({ error: "Completion attachment is required" });
      }
      let newAttachmentAbsolutePath: string | null = null;

      try {
        const [existing] = await db
          .select({
            id: maintenanceSchedules.id,
            machineId: maintenanceSchedules.machineId,
            completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
            previousScheduledDate: maintenanceSchedules.previousScheduledDate,
            machineCode: machines.code,
            machineName: machines.name,
          })
          .from(maintenanceSchedules)
          .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
          .where(eq(maintenanceSchedules.id, id))
          .limit(1);

        if (!existing) {
          return res.status(404).json({ error: "Maintenance plan not found" });
        }

        let attachmentPath = existing.completionAttachmentPath ?? null;

        await fs.mkdir(COMPLETION_DIR, { recursive: true });
        const sourceLabel = (existing.machineCode || existing.machineName || "completion") as string;
        const sanitizedLabel = sourceLabel
          .normalize("NFKD")
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();
        const shortName = sanitizedLabel.length > 0 ? sanitizedLabel.slice(0, 24) : "completion";
        const extension = path.extname(file.originalname || "").toLowerCase();
        const randomSuffix = randomBytes(4).toString("hex");
        const fileName = `${shortName}-${randomSuffix}${extension}`;

        const relativePath = path.posix.join("uploads", "completion-docs", fileName);
        const absolutePath = path.join(COMPLETION_DIR, fileName);
        newAttachmentAbsolutePath = absolutePath;

        await fs.writeFile(absolutePath, file.buffer);
        attachmentPath = relativePath;

        if (existing.completionAttachmentPath) {
          const existingAbsolute = path.join(process.cwd(), existing.completionAttachmentPath);
          const normalizedDir = path.normalize(COMPLETION_DIR + path.sep);
          const normalizedExisting = path.normalize(existingAbsolute);
          if (normalizedExisting.startsWith(normalizedDir)) {
            try {
              await fs.unlink(existingAbsolute);
            } catch {
              // ignore cleanup errors for old attachments
            }
          }
        }

        const [updated] = await db
          .update(maintenanceSchedules)
          .set({
            status: "completed",
            completedAt: new Date(),
            updatedAt: new Date(),
            completionRemark: remarkRaw,
            completionAttachmentPath: attachmentPath,
          })
          .where(eq(maintenanceSchedules.id, id))
          .returning({ id: maintenanceSchedules.id });

        if (!updated) {
          return res.status(404).json({ error: "Maintenance plan not found" });
        }

        await sendMaintenanceCompletionNotification(updated.id);

        const [schedule] = await db
          .select({
            id: maintenanceSchedules.id,
            machineId: maintenanceSchedules.machineId,
            machineCodeStored: maintenanceSchedules.machineCode,
            machineCodeDerived: machines.code,
            scheduledDate: maintenanceSchedules.scheduledDate,
            shift: maintenanceSchedules.shift,
            status: maintenanceSchedules.status,
            maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
            maintenanceType: maintenanceSchedules.maintenanceType,
            notes: maintenanceSchedules.notes,
            emailRecipients: maintenanceSchedules.emailRecipients,
            emailTemplate: maintenanceSchedules.emailTemplate,
            checksheetPath: maintenanceSchedules.checksheetPath,
            completionRemark: maintenanceSchedules.completionRemark,
            completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
            preNotificationSent: maintenanceSchedules.preNotificationSent,
            createdAt: maintenanceSchedules.createdAt,
            updatedAt: maintenanceSchedules.updatedAt,
            completedAt: maintenanceSchedules.completedAt,
            machineName: machines.name,
            lineName: lines.name,
            machineType: machines.type,
          })
          .from(maintenanceSchedules)
          .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
          .leftJoin(lines, eq(machines.lineId, lines.id))
          .where(eq(maintenanceSchedules.id, updated.id))
          .limit(1);

        if (!schedule) {
          return res.status(500).json({ error: "Failed to load maintenance plan after update" });
        }

        const historyEntries = schedule.id ? await fetchRescheduleHistoryForId(schedule.id) : [];
        res.json(toClientSchedule(schedule, historyEntries));
      } catch (error) {
        if (newAttachmentAbsolutePath) {
          try {
            await fs.unlink(newAttachmentAbsolutePath);
          } catch {
            // ignore cleanup errors for newly uploaded file
          }
        }
        console.error("Failed to complete maintenance plan:", error);
        const message =
          error instanceof Error && error.message ? error.message : "Failed to complete maintenance plan";
        res.status(500).json({ error: message });
      }
    },
  );

  app.post(
    "/api/maintenance-plans/:id/checksheet",
    isAuthenticated,
    hasRole("Admin", "Supervisor"),
    (req, res, next) => {
      checksheetUpload.single("checksheet")(req as any, res as any, (err: unknown) => {
        if (err) {
          const message = err instanceof Error ? err.message : "Failed to upload checksheet";
          return res.status(400).json({ error: message });
        }
        next();
      });
    },
    async (req, res) => {
      const { id } = req.params;
      const file = (req as any).file as { originalname?: string; buffer: Buffer } | undefined;

      console.log("POST /api/maintenance-plans/:id/checksheet", {
        scheduleId: id,
        hasFile: Boolean(file),
        userId: (req.user as { id?: string } | undefined)?.id ?? null,
      });

      if (!file) {
        return res.status(400).json({ error: "Checksheet file is required" });
      }

      let newFileAbsolutePath: string | null = null;

      try {
        const [schedule] = await db
          .select({
            id: maintenanceSchedules.id,
            machineId: maintenanceSchedules.machineId,
            existingPath: maintenanceSchedules.checksheetPath,
            machineCode: machines.code,
            machineName: machines.name,
          })
          .from(maintenanceSchedules)
          .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
          .where(eq(maintenanceSchedules.id, id))
          .limit(1);

        if (!schedule) {
          return res.status(404).json({ error: "Maintenance plan not found" });
        }

        await fs.mkdir(CHECKSHEET_DIR, { recursive: true });

        const sourceLabel = (schedule.machineCode || schedule.machineName || "machine") as string;
        const sanitizedLabel = sourceLabel
          .normalize("NFKD")
          .replace(/[^A-Za-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .toLowerCase();
        const shortName = sanitizedLabel.length > 0 ? sanitizedLabel.slice(0, 20) : "machine";

        const extension = path.extname(file.originalname || "").toLowerCase();
        const randomSuffix = randomBytes(4).toString("hex");
        const fileName = `${shortName}-${randomSuffix}${extension}`;

        const relativePath = path.posix.join("uploads", "checksheets", fileName);
        const absolutePath = path.join(CHECKSHEET_DIR, fileName);
        newFileAbsolutePath = absolutePath;

        await fs.writeFile(absolutePath, file.buffer);

        await db
          .update(maintenanceSchedules)
          .set({
            checksheetPath: relativePath,
            updatedAt: new Date(),
          })
          .where(eq(maintenanceSchedules.id, id));

        if (schedule.existingPath) {
          const existingAbsolute = path.join(process.cwd(), schedule.existingPath);
          const normalizedDir = path.normalize(CHECKSHEET_DIR + path.sep);
          const normalizedExisting = path.normalize(existingAbsolute);
          if (normalizedExisting.startsWith(normalizedDir)) {
            try {
              await fs.unlink(existingAbsolute);
            } catch {
              // Ignore errors when removing old files
            }
          }
        }

        const [updatedSchedule] = await db
          .select({
            id: maintenanceSchedules.id,
            machineId: maintenanceSchedules.machineId,
            machineCodeStored: maintenanceSchedules.machineCode,
            machineCodeDerived: machines.code,
            scheduledDate: maintenanceSchedules.scheduledDate,
            shift: maintenanceSchedules.shift,
            status: maintenanceSchedules.status,
            maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
            maintenanceType: maintenanceSchedules.maintenanceType,
            notes: maintenanceSchedules.notes,
            emailRecipients: maintenanceSchedules.emailRecipients,
            emailTemplate: maintenanceSchedules.emailTemplate,
            checksheetPath: maintenanceSchedules.checksheetPath,
            preNotificationSent: maintenanceSchedules.preNotificationSent,
            createdAt: maintenanceSchedules.createdAt,
            updatedAt: maintenanceSchedules.updatedAt,
            completedAt: maintenanceSchedules.completedAt,
            machineName: machines.name,
            lineName: lines.name,
            machineType: machines.type,
            previousScheduledDate: maintenanceSchedules.previousScheduledDate,
        })
          .from(maintenanceSchedules)
          .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
          .leftJoin(lines, eq(machines.lineId, lines.id))
          .where(eq(maintenanceSchedules.id, id))
          .limit(1);

        if (!updatedSchedule) {
          return res
            .status(500)
            .json({ error: "Failed to load updated maintenance plan after saving checksheet" });
        }

        const historyEntries = updatedSchedule.id ? await fetchRescheduleHistoryForId(updatedSchedule.id) : [];
        res.json(toClientSchedule(updatedSchedule, historyEntries));
      } catch (error) {
        if (newFileAbsolutePath) {
          try {
            await fs.unlink(newFileAbsolutePath);
          } catch {
            // ignore cleanup errors
          }
        }
        console.error("Failed to upload checksheet:", error);
        const message = error instanceof Error && error.message ? error.message : "Failed to upload checksheet";
        res.status(500).json({ error: message });
      }
    },
  );

  app.get("/api/maintenance-plans/:id/checksheet", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const [schedule] = await db
        .select({
          checksheetPath: maintenanceSchedules.checksheetPath,
          machineCode: machines.code,
          machineName: machines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .where(eq(maintenanceSchedules.id, id))
        .limit(1);

      if (!schedule) {
        return res.status(404).json({ error: "Maintenance plan not found" });
      }

      if (!schedule.checksheetPath) {
        return res.status(404).json({ error: "Checksheet not available" });
      }

      const absolutePath = path.join(process.cwd(), schedule.checksheetPath);
      const normalizedDir = path.normalize(CHECKSHEET_DIR + path.sep);
      const normalizedAbsolute = path.normalize(absolutePath);

      if (!normalizedAbsolute.startsWith(normalizedDir)) {
        return res.status(400).json({ error: "Invalid checksheet path" });
      }

      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({ error: "Checksheet not available" });
      }

      const downloadLabel = (schedule.machineCode || schedule.machineName || "checksheet").toString();
      const safeLabel = downloadLabel
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "checksheet";
      const downloadName = `${safeLabel}${path.extname(absolutePath).toLowerCase()}`;

      res.download(absolutePath, downloadName, (err) => {
        if (err) {
          console.error("Failed to send checksheet:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download checksheet" });
          }
        }
      });
    } catch (error) {
      console.error("Failed to download checksheet:", error);
      const message = error instanceof Error && error.message ? error.message : "Failed to download checksheet";
      res.status(500).json({ error: message });
    }
  });

  app.get("/api/maintenance-plans/:id/completion-attachment", isAuthenticated, async (req, res) => {
    try {
      const { id } = req.params;
      const [schedule] = await db
        .select({
          completionAttachmentPath: maintenanceSchedules.completionAttachmentPath,
          machineCode: machines.code,
          machineName: machines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .where(eq(maintenanceSchedules.id, id))
        .limit(1);

      if (!schedule) {
        return res.status(404).json({ error: "Maintenance plan not found" });
      }

      if (!schedule.completionAttachmentPath) {
        return res.status(404).json({ error: "Completion attachment not available" });
      }

      const absolutePath = path.join(process.cwd(), schedule.completionAttachmentPath);
      const normalizedDir = path.normalize(COMPLETION_DIR + path.sep);
      const normalizedAbsolute = path.normalize(absolutePath);

      if (!normalizedAbsolute.startsWith(normalizedDir)) {
        return res.status(400).json({ error: "Invalid completion attachment path" });
      }

      try {
        await fs.access(absolutePath);
      } catch {
        return res.status(404).json({ error: "Completion attachment not available" });
      }

      const downloadLabel = (schedule.machineCode || schedule.machineName || "completion").toString();
      const safeLabel = downloadLabel
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .toLowerCase() || "completion";
      const downloadName = `${safeLabel}${path.extname(absolutePath).toLowerCase()}`;

      res.download(absolutePath, downloadName, (err) => {
        if (err) {
          console.error("Failed to send completion attachment:", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to download completion attachment" });
          }
        }
      });
    } catch (error) {
      console.error("Failed to download completion attachment:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to download completion attachment";
      res.status(500).json({ error: message });
    }
  });

  app.delete(
    "/api/maintenance-plans/:id/checksheet",
    isAuthenticated,
    hasRole("Admin", "Supervisor"),
    async (req, res) => {
      try {
        const { id } = req.params;
        const [schedule] = await db
          .select({
            checksheetPath: maintenanceSchedules.checksheetPath,
          })
          .from(maintenanceSchedules)
          .where(eq(maintenanceSchedules.id, id))
          .limit(1);

        if (!schedule) {
          return res.status(404).json({ error: "Maintenance plan not found" });
        }

        if (!schedule.checksheetPath) {
          return res.status(404).json({ error: "Checksheet not available" });
        }

        const absolutePath = path.join(process.cwd(), schedule.checksheetPath);
        const normalizedDir = path.normalize(CHECKSHEET_DIR + path.sep);
        const normalizedAbsolute = path.normalize(absolutePath);

        if (!normalizedAbsolute.startsWith(normalizedDir)) {
          return res.status(400).json({ error: "Invalid checksheet path" });
        }

        try {
          await fs.unlink(absolutePath);
        } catch (error) {
          console.error("Failed to remove checksheet file:", error);
          return res.status(500).json({ error: "Failed to remove checksheet file" });
        }

        await db
          .update(maintenanceSchedules)
          .set({
            checksheetPath: null,
            updatedAt: new Date(),
          })
          .where(eq(maintenanceSchedules.id, id));

        res.json({ message: "Checksheet removed" });
      } catch (error) {
        console.error("Failed to remove checksheet:", error);
        const message = error instanceof Error && error.message ? error.message : "Failed to remove checksheet";
        res.status(500).json({ error: message });
      }
    },
  );

  app.delete(
    "/api/maintenance-plans/:id",
    isAuthenticated,
    hasRole("Admin"),
    async (req, res) => {
      try {
        const { id } = req.params;

        const [schedule] = await db
          .select({
            id: maintenanceSchedules.id,
            status: maintenanceSchedules.status,
          })
          .from(maintenanceSchedules)
          .where(eq(maintenanceSchedules.id, id))
          .limit(1);

        if (!schedule) {
          return res.status(404).json({ error: "Maintenance plan not found" });
        }

        if ((schedule.status || "").toLowerCase() === "completed") {
          return res.status(400).json({ error: "Completed maintenance cannot be deleted" });
        }

        await db.delete(maintenanceSchedules).where(eq(maintenanceSchedules.id, id));

        res.json({ message: "Maintenance plan deleted" });
      } catch (error) {
        console.error("Failed to delete maintenance plan:", error);
        res.status(500).json({ error: "Failed to delete maintenance plan" });
      }
    },
  );

  // Employees
  app.post("/api/employees", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { name, department, role } = req.body;
      const [employee] = await db
        .insert(employees)
        .values({ name, department, role, createdBy: userId, createdAt: new Date(), updatedBy: null, updatedAt: null })
        .returning();
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: "Failed to create employee" });
    }
  });

  app.post("/api/employees/bulk", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const records = Array.isArray(req.body?.records) ? req.body.records : null;
      if (!records || records.length === 0) {
        return res.status(400).json({ error: "No records provided" });
      }

      type BulkEmployeeRecord = {
        name: string;
        role: string | null;
        department: string | null;
      };

      const sanitized: BulkEmployeeRecord[] = records
        .map((record: any) => ({
          name: normalizeText(record?.name),
          role: toNullableText(record?.role),
          department: toNullableText(record?.department),
        }))
        .filter((record: BulkEmployeeRecord) => record.name.length > 0);

      if (sanitized.length === 0) {
        return res.status(400).json({ error: "No valid employees found" });
      }

      const summary = {
        created: 0,
        skipped: 0,
      };

      await db.transaction(async (tx) => {
        const existing = await tx.select().from(employees);
        const existingByName = new Map(
          existing.map((employee) => [employee.name.trim().toLowerCase(), employee]),
        );

        for (const record of sanitized) {
          const key = record.name.toLowerCase();
          if (existingByName.has(key)) {
            summary.skipped += 1;
            continue;
          }

          const [created] = await tx
            .insert(employees)
            .values({
              name: record.name,
              department: record.department,
              role: record.role,
              createdBy: userId,
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
            })
            .returning();

          if (created) {
            existingByName.set(key, created);
            summary.created += 1;
          }
        }
      });

      res.json({ summary });
    } catch (error) {
      console.error("Failed to bulk import employees:", error);
      res.status(400).json({ error: "Failed to import employees" });
    }
  });

  app.put("/api/employees/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const { name, department, role } = req.body;
      const [employee] = await db.update(employees)
        .set({ name, department, role, updatedBy: userId, updatedAt: new Date() })
        .where(eq(employees.id, id))
        .returning();
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: "Failed to update employee" });
    }
  });

  app.delete("/api/employees/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(employees).where(eq(employees.id, id));
      res.json({ message: "Employee deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete employee" });
    }
  });

  // Problem Types
  app.post("/api/problem-types", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { name, description } = req.body;
      const [problemType] = await db
        .insert(problemTypes)
        .values({ name, description, createdBy: userId, createdAt: new Date(), updatedBy: null, updatedAt: null })
        .returning();
      res.json(problemType);
    } catch (error) {
      res.status(400).json({ error: "Failed to create problem type" });
    }
  });

  app.post("/api/problem-types/bulk", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const records = Array.isArray(req.body?.records) ? req.body.records : null;
      if (!records || records.length === 0) {
        return res.status(400).json({ error: "No records provided" });
      }

      type BulkProblemTypeRecord = {
        name: string;
        description: string | null;
      };

      const sanitized: BulkProblemTypeRecord[] = records
        .map((record: any) => ({
          name: normalizeText(record?.name),
          description: toNullableText(record?.description),
        }))
        .filter((record: BulkProblemTypeRecord) => record.name.length > 0);

      if (sanitized.length === 0) {
        return res.status(400).json({ error: "No valid problem types found" });
      }

      const summary = {
        created: 0,
        skipped: 0,
      };

      await db.transaction(async (tx) => {
        const existing = await tx.select().from(problemTypes);
        const existingByName = new Map(
          existing.map((problemType) => [problemType.name.trim().toLowerCase(), problemType]),
        );

        for (const record of sanitized) {
          const key = record.name.toLowerCase();
          if (existingByName.has(key)) {
            summary.skipped += 1;
            continue;
          }

          const [created] = await tx
            .insert(problemTypes)
            .values({
              name: record.name,
              description: record.description,
              createdBy: userId,
              createdAt: new Date(),
              updatedBy: null,
              updatedAt: null,
            })
            .returning();

          if (created) {
            existingByName.set(key, created);
            summary.created += 1;
          }
        }
      });

      res.json({ summary });
    } catch (error) {
      console.error("Failed to bulk import problem types:", error);
      res.status(400).json({ error: "Failed to import problem types" });
    }
  });

  app.put("/api/problem-types/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const { name, description } = req.body;
      const [problemType] = await db.update(problemTypes)
        .set({ name, description, updatedBy: userId, updatedAt: new Date() })
        .where(eq(problemTypes.id, id))
        .returning();
      if (!problemType) {
        return res.status(404).json({ error: "Problem type not found" });
      }
      res.json(problemType);
    } catch (error) {
      res.status(400).json({ error: "Failed to update problem type" });
    }
  });

  app.delete("/api/problem-types/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(problemTypes).where(eq(problemTypes.id, id));
      res.json({ message: "Problem type deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete problem type" });
    }
  });

  // CAPA 4M Categories
  app.post("/api/capa-categories", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const name = normalizeText(req.body?.name);
      if (!name) {
        return res.status(400).json({ error: "Category name is required" });
      }

      const [created] = await db
        .insert(capaCategories)
        .values({
          name,
          createdBy: userId,
          createdAt: new Date(),
          updatedBy: null,
          updatedAt: null,
        })
        .returning();

      res.json(created);
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        return res.status(400).json({ error: "Category already exists" });
      }
      res.status(400).json({ error: "Failed to create CAPA category" });
    }
  });

  app.put("/api/capa-categories/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const userId = (req.user as any)?.id ?? null;
      const { id } = req.params;
      const name = normalizeText(req.body?.name);
      if (!name) {
        return res.status(400).json({ error: "Category name is required" });
      }

      const [updated] = await db
        .update(capaCategories)
        .set({
          name,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(capaCategories.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ error: "CAPA category not found" });
      }

      res.json(updated);
    } catch (error: any) {
      const message = String(error?.message ?? "");
      if (message.toLowerCase().includes("duplicate") || message.toLowerCase().includes("unique")) {
        return res.status(400).json({ error: "Category already exists" });
      }
      res.status(400).json({ error: "Failed to update CAPA category" });
    }
  });

  app.delete("/api/capa-categories/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db
        .delete(capaCategories)
        .where(eq(capaCategories.id, id))
        .returning({ id: capaCategories.id });

      if (!deleted) {
        return res.status(404).json({ error: "CAPA category not found" });
      }

      res.json({ message: "CAPA category deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete CAPA category" });
    }
  });

  app.get("/api/reports/bd", isAuthenticated, async (req, res) => {
    try {
      const rawStartDate = sanitizeDateParam(getQueryValue(req.query.startDate as string | string[] | undefined));
      const rawEndDate = sanitizeDateParam(getQueryValue(req.query.endDate as string | string[] | undefined));
      const lineId = getQueryValue(req.query.lineId as string | string[] | undefined);
      const subLineId = getQueryValue(req.query.subLineId as string | string[] | undefined);
      const machineId = getQueryValue(req.query.machineId as string | string[] | undefined);
      const statusFilter = getQueryValue(req.query.status as string | string[] | undefined);
      const problemTypeId = getQueryValue(req.query.problemTypeId as string | string[] | undefined);

      let startDate = rawStartDate;
      let endDate = rawEndDate;
      if (startDate && endDate && startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
      }

      const conditions: any[] = [isNull(breakdowns.deletedAt)];

      if (startDate) {
        conditions.push(gte(breakdowns.date, startDate));
      }
      if (endDate) {
        conditions.push(lte(breakdowns.date, endDate));
      }
      if (lineId) {
        conditions.push(eq(breakdowns.lineId, lineId));
      }
      if (subLineId) {
        conditions.push(eq(breakdowns.subLineId, subLineId));
      }
      if (machineId) {
        conditions.push(eq(breakdowns.machineId, machineId));
      }
      if (statusFilter) {
        conditions.push(eq(breakdowns.status, statusFilter));
      }
      if (problemTypeId) {
        conditions.push(eq(breakdowns.problemTypeId, problemTypeId));
      }

      const baseQuery = db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          lineName: lines.name,
          subLineName: subLines.name,
          machineName: machines.name,
          machineCode: machines.code,
          maintenanceType: sql<string>`'Breakdown'`,
          problemTypeName: problemTypes.name,
          startTime: breakdowns.startTime,
          finishTime: breakdowns.finishTime,
          totalMinutes: breakdowns.totalMinutes,
          majorContribution: breakdowns.majorContribution,
          majorContributionTime: breakdowns.majorContributionTime,
          problem: breakdowns.problemDescription,
          action: breakdowns.actionTaken,
          rootCause: breakdowns.rootCause,
          status: breakdowns.status,
        })
        .from(breakdowns)
        .leftJoin(lines, eq(breakdowns.lineId, lines.id))
        .leftJoin(subLines, eq(breakdowns.subLineId, subLines.id))
        .leftJoin(machines, eq(breakdowns.machineId, machines.id))
        .leftJoin(problemTypes, eq(breakdowns.problemTypeId, problemTypes.id));

      const filteredQuery =
        conditions.length > 0
          ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
          : baseQuery;

      const rows = await filteredQuery.orderBy(desc(breakdowns.date), desc(breakdowns.startTime));
      const data = rows.map((row) => {
        const derivedMinutes = computeBreakdownDurationMinutes(row.startTime, row.finishTime, row.totalMinutes);
        const formattedDuration = formatMinutesAsDuration(derivedMinutes);
        const machineCode =
          typeof row.machineCode === "string" && row.machineCode.trim().length > 0
            ? row.machineCode.trim()
            : null;

        return {
          id: row.id,
          date: row.date,
          lineName: row.lineName ?? null,
          subLineName: row.subLineName ?? null,
          machineName: row.machineName ?? null,
          machineCode,
          maintenanceType: "Breakdown",
          problemType: row.problemTypeName ?? null,
          bdStartTime: row.startTime ?? null,
          bdCloseTime: row.finishTime ?? null,
          bdTotalMinutes: derivedMinutes,
          bdTotalTime: formattedDuration,
          majorContributionBy: row.majorContribution ?? null,
          majorContributionTime: row.majorContributionTime ?? null,
          problem: row.problem ?? null,
          action: row.action ?? null,
          rootCause: row.rootCause ?? null,
          status: row.status ?? null,
        };
      });

      res.json({ data });
    } catch (error) {
      console.error("Failed to generate BD report:", error);
      res.status(500).json({ error: "Failed to generate BD report" });
    }
  });

  const handleAnnualReportRequest = async (
    req: Request,
    res: Response,
    options: { defaultFrequency?: string | null; defaultMaintenanceType?: string | null; errorLabel: string },
  ) => {
    const { defaultFrequency = null, defaultMaintenanceType = null, errorLabel } = options;

    try {
      const yearParam = getQueryValue(req.query.year as string | string[] | undefined);
      const parsedYear = parseYearParamValue(yearParam);
      const targetYear = parsedYear ?? new Date().getFullYear();

      const lineId = getQueryValue(req.query.lineId as string | string[] | undefined);
      const subLineId = getQueryValue(req.query.subLineId as string | string[] | undefined);
      const machineId = getQueryValue(req.query.machineId as string | string[] | undefined);
      const statusFilterRaw = getQueryValue(req.query.status as string | string[] | undefined);
      const frequencyParam = getQueryValue(req.query.frequency as string | string[] | undefined);
      const frequencyInput = frequencyParam ?? defaultFrequency ?? "all";
      const normalizedFrequency =
        typeof frequencyInput === "string" && frequencyInput.trim().length > 0
          ? frequencyInput.trim().toLowerCase()
          : "all";
      const frequencyFilter =
        normalizedFrequency === "all" || normalizedFrequency.length === 0 ? null : normalizedFrequency;

      const maintenanceTypeParam = getQueryValue(req.query.maintenanceType as string | string[] | undefined);
      const maintenanceTypeInput = maintenanceTypeParam ?? defaultMaintenanceType ?? null;
      let maintenanceTypeFilter: string | null = null;
      if (maintenanceTypeInput && maintenanceTypeInput.trim().length > 0) {
        if (maintenanceTypeInput.trim().toLowerCase() !== "all") {
          const normalizedType = normalizeMaintenanceType(maintenanceTypeInput);
          if (!normalizedType) {
            return res.status(400).json({
              error: maintenanceTypeValidationMessage,
            });
          }
          maintenanceTypeFilter = normalizedType.toLowerCase();
        }
      }

      const startDate = `${targetYear}-01-01`;
      const endDate = `${targetYear}-12-31`;

      const conditions: any[] = [
        gte(maintenanceSchedules.scheduledDate, startDate),
        lte(maintenanceSchedules.scheduledDate, endDate),
      ];

      if (machineId) {
        conditions.push(eq(maintenanceSchedules.machineId, machineId));
      }
      if (lineId) {
        conditions.push(eq(machines.lineId, lineId));
      }
      if (subLineId) {
        conditions.push(eq(machines.subLineId, subLineId));
      }
      if (frequencyFilter) {
        conditions.push(sql`lower(${maintenanceSchedules.maintenanceFrequency}) = ${frequencyFilter}`);
      }
      if (maintenanceTypeFilter) {
        conditions.push(sql`lower(${maintenanceSchedules.maintenanceType}) = ${maintenanceTypeFilter}`);
      }

      const baseQuery = db
        .select({
          id: maintenanceSchedules.id,
          scheduledDate: maintenanceSchedules.scheduledDate,
          completedAt: maintenanceSchedules.completedAt,
          notes: maintenanceSchedules.notes,
          completionRemark: maintenanceSchedules.completionRemark,
          frequency: maintenanceSchedules.maintenanceFrequency,
          lineName: lines.name,
          subLineName: subLines.name,
          machineName: machines.name,
          machineCode: machines.code,
          machineType: machines.type,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .leftJoin(subLines, eq(machines.subLineId, subLines.id));

      const filteredQuery =
        conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      const rows = await filteredQuery.orderBy(
        asc(maintenanceSchedules.scheduledDate),
        asc(machines.name),
      );
      const normalizedStatusFilter =
        typeof statusFilterRaw === "string" && statusFilterRaw.trim().length > 0
          ? statusFilterRaw.trim().toLowerCase()
          : null;

      const mapped = rows.map((row) => {
        const pmPlanDate = toDateString(row.scheduledDate);
        const status = derivePlanStatus(row.scheduledDate, row.completedAt);
        const remarksCandidate =
          typeof row.completionRemark === "string" && row.completionRemark.trim().length > 0
            ? row.completionRemark.trim()
            : typeof row.notes === "string" && row.notes.trim().length > 0
              ? row.notes.trim()
              : null;

        return {
          pmPlanDate,
          lineName: row.lineName ?? null,
          subLineName: row.subLineName ?? null,
          machineName: row.machineName ?? null,
          machineCode: row.machineCode ?? null,
          machineType: row.machineType ?? null,
          frequency: row.frequency ?? null,
          status,
          remarks: remarksCandidate,
        };
      });

      const filtered = normalizedStatusFilter
        ? mapped.filter((item) => item.status.toLowerCase() === normalizedStatusFilter)
        : mapped;

      const data = filtered.map((item, index) => ({
        serialNumber: index + 1,
        ...item,
      }));

      res.json({ data });
    } catch (error) {
      console.error(`Failed to generate ${errorLabel}:`, error);
      res.status(500).json({ error: `Failed to generate ${errorLabel}` });
    }
  };

  app.get("/api/reports/annual-pm", isAuthenticated, (req, res) =>
    handleAnnualReportRequest(req, res, {
      defaultFrequency: "yearly",
      errorLabel: "Annual PM report",
    }),
  );

  app.get("/api/reports/annual-predictive", isAuthenticated, (req, res) =>
    handleAnnualReportRequest(req, res, {
      defaultMaintenanceType: "Predictive",
      errorLabel: "Annual Predictive report",
    }),
  );

  app.get("/api/reports/overhaul", isAuthenticated, (req, res) =>
    handleAnnualReportRequest(req, res, {
      defaultMaintenanceType: "Overhauling",
      errorLabel: "Overhaul report",
    }),
  );

  app.get("/api/reports/long-pending", isAuthenticated, async (req, res) => {
    try {
      const lineId = getQueryValue(req.query.lineId as string | string[] | undefined);
      const subLineId = getQueryValue(req.query.subLineId as string | string[] | undefined);
      const machineId = getQueryValue(req.query.machineId as string | string[] | undefined);
      const problemTypeId = getQueryValue(req.query.problemTypeId as string | string[] | undefined);
      const statusParam = getQueryValue(req.query.status as string | string[] | undefined);
      const minDaysParam = getQueryValue(req.query.minDays as string | string[] | undefined);
      const minDays = (() => {
        if (!minDaysParam) return 7;
        const parsed = Number.parseInt(minDaysParam, 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
      })();

      const normalizedStatus = (() => {
        if (!statusParam) {
          return null;
        }
        const trimmed = statusParam.trim().toLowerCase();
        if (!trimmed || trimmed === "all") {
          return null;
        }
        if (["open", "pending", "closed"].includes(trimmed)) {
          return trimmed;
        }
        return null;
      })();

      const conditions: any[] = [isNull(breakdowns.deletedAt)];
      if (lineId) {
        conditions.push(eq(breakdowns.lineId, lineId));
      }
      if (subLineId) {
        conditions.push(eq(breakdowns.subLineId, subLineId));
      }
      if (machineId) {
        conditions.push(eq(breakdowns.machineId, machineId));
      }
      if (problemTypeId) {
        conditions.push(eq(breakdowns.problemTypeId, problemTypeId));
      }
      if (normalizedStatus) {
        conditions.push(eq(breakdowns.status, normalizedStatus));
      } else {
        conditions.push(inArray(breakdowns.status, ["open", "pending"]));
      }

      const baseQuery = db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          lineName: lines.name,
          subLineName: subLines.name,
          machineName: machines.name,
          machineCode: machines.code,
          priority: breakdowns.priority,
          status: breakdowns.status,
          problemDescription: breakdowns.problemDescription,
          actionTaken: breakdowns.actionTaken,
          rootCause: breakdowns.rootCause,
          totalMinutes: breakdowns.totalMinutes,
          problemTypeName: problemTypes.name,
        })
        .from(breakdowns)
        .leftJoin(lines, eq(breakdowns.lineId, lines.id))
        .leftJoin(subLines, eq(breakdowns.subLineId, subLines.id))
        .leftJoin(machines, eq(breakdowns.machineId, machines.id))
        .leftJoin(problemTypes, eq(breakdowns.problemTypeId, problemTypes.id));

      const filteredQuery =
        conditions.length > 0
          ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
          : baseQuery;

      const rows = await filteredQuery.orderBy(asc(breakdowns.date));

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const data = rows
        .map((row) => {
          const reportedDate = row.date ? new Date(row.date) : null;
          let daysPending = 0;
          if (reportedDate && !Number.isNaN(reportedDate.getTime())) {
            reportedDate.setHours(0, 0, 0, 0);
            const diffMs = today.getTime() - reportedDate.getTime();
            daysPending = diffMs > 0 ? Math.floor(diffMs / (1000 * 60 * 60 * 24)) : 0;
          }

          return {
            id: row.id,
            date: toDateString(row.date),
            lineName: row.lineName ?? null,
            subLineName: row.subLineName ?? null,
            machineName: row.machineName ?? null,
            machineCode: row.machineCode ?? null,
            priority: row.priority ?? null,
            status: row.status ?? null,
            problemDescription: row.problemDescription ?? null,
            actionTaken: row.actionTaken ?? null,
            rootCause: row.rootCause ?? null,
            daysPending,
            problemType: row.problemTypeName ?? null,
          };
        })
        .filter((item) => item.daysPending >= minDays)
        .sort((a, b) => b.daysPending - a.daysPending)
        .map((item, index) => ({
          serialNumber: index + 1,
          ...item,
        }));

      res.json({ data });
    } catch (error) {
      console.error("Failed to generate Long Pending report:", error);
      res.status(500).json({ error: "Failed to generate Long Pending report" });
    }
  });

  const handleMonthlyReportRequest = async (
    req: Request,
    res: Response,
    options: { defaultMaintenanceType?: string | null; errorLabel: string },
  ) => {
    const { defaultMaintenanceType = null, errorLabel } = options;

    try {
      const yearParam = getQueryValue(req.query.year as string | string[] | undefined);
      const monthParam = getQueryValue(req.query.month as string | string[] | undefined);

      const parsedYear = parseYearParamValue(yearParam) ?? new Date().getFullYear();
      const parsedMonth = (() => {
        if (!monthParam) return new Date().getMonth() + 1;
        const trimmed = monthParam.trim();
        if (!trimmed) return new Date().getMonth() + 1;
        const numeric = Number.parseInt(trimmed, 10);
        if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 12) {
          return numeric;
        }
        const monthIndex = new Date(`${trimmed} 1, ${parsedYear}`).getMonth();
        return Number.isNaN(monthIndex) ? new Date().getMonth() + 1 : monthIndex + 1;
      })();

      const lineId = getQueryValue(req.query.lineId as string | string[] | undefined);
      const subLineId = getQueryValue(req.query.subLineId as string | string[] | undefined);
      const machineId = getQueryValue(req.query.machineId as string | string[] | undefined);
      const statusFilterRaw = getQueryValue(req.query.status as string | string[] | undefined);
      const frequencyParam = getQueryValue(req.query.frequency as string | string[] | undefined);
      const normalizedFrequency =
        frequencyParam && frequencyParam.trim().length > 0 ? frequencyParam.trim().toLowerCase() : "monthly";
      const frequencyFilter =
        normalizedFrequency === "all" || normalizedFrequency.length === 0 ? null : normalizedFrequency;

      const maintenanceTypeParam = getQueryValue(req.query.maintenanceType as string | string[] | undefined);
      const mergedMaintenanceType = maintenanceTypeParam ?? defaultMaintenanceType;
      let maintenanceTypeFilter: string | null = null;
      if (mergedMaintenanceType && mergedMaintenanceType.toLowerCase() !== "all") {
        const normalizedType = normalizeMaintenanceType(mergedMaintenanceType);
        if (!normalizedType) {
          return res.status(400).json({
            error: maintenanceTypeValidationMessage,
          });
        }
        maintenanceTypeFilter = normalizedType.toLowerCase();
      }

      const startDate = new Date(parsedYear, parsedMonth - 1, 1);
      const endDate = new Date(parsedYear, parsedMonth, 0);
      const startDateString = startDate.toISOString().split("T")[0]!;
      const endDateString = endDate.toISOString().split("T")[0]!;

      const conditions: any[] = [
        gte(maintenanceSchedules.scheduledDate, startDateString),
        lte(maintenanceSchedules.scheduledDate, endDateString),
      ];

      if (machineId) {
        conditions.push(eq(maintenanceSchedules.machineId, machineId));
      }
      if (lineId) {
        conditions.push(eq(machines.lineId, lineId));
      }
      if (subLineId) {
        conditions.push(eq(machines.subLineId, subLineId));
      }
      if (frequencyFilter) {
        conditions.push(sql`lower(${maintenanceSchedules.maintenanceFrequency}) = ${frequencyFilter}`);
      }
      if (maintenanceTypeFilter) {
        conditions.push(sql`lower(${maintenanceSchedules.maintenanceType}) = ${maintenanceTypeFilter}`);
      }

      const baseQuery = db
        .select({
          id: maintenanceSchedules.id,
          scheduledDate: maintenanceSchedules.scheduledDate,
          completedAt: maintenanceSchedules.completedAt,
          notes: maintenanceSchedules.notes,
          completionRemark: maintenanceSchedules.completionRemark,
          frequency: maintenanceSchedules.maintenanceFrequency,
          lineName: lines.name,
          subLineName: subLines.name,
          machineName: machines.name,
          machineCode: machines.code,
          machineType: machines.type,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .leftJoin(subLines, eq(machines.subLineId, subLines.id));

      const filteredQuery =
        conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;

      const rows = await filteredQuery.orderBy(
        asc(maintenanceSchedules.scheduledDate),
        asc(machines.name),
      );

      const normalizedStatusFilter =
        typeof statusFilterRaw === "string" && statusFilterRaw.trim().length > 0
          ? statusFilterRaw.trim().toLowerCase()
          : null;

      const mapped = rows.map((row) => {
        const pmPlanDate = toDateString(row.scheduledDate);
        const status = derivePlanStatus(row.scheduledDate, row.completedAt);
        const remarksCandidate =
          typeof row.completionRemark === "string" && row.completionRemark.trim().length > 0
            ? row.completionRemark.trim()
            : typeof row.notes === "string" && row.notes.trim().length > 0
              ? row.notes.trim()
              : null;

        return {
          pmPlanDate,
          lineName: row.lineName ?? null,
          subLineName: row.subLineName ?? null,
          machineName: row.machineName ?? null,
          machineCode: row.machineCode ?? null,
          machineType: row.machineType ?? null,
          frequency: row.frequency ?? null,
          status,
          remarks: remarksCandidate,
        };
      });

      const filtered = normalizedStatusFilter
        ? mapped.filter((item) => item.status.toLowerCase() === normalizedStatusFilter)
        : mapped;

      const data = filtered.map((item, index) => ({
        serialNumber: index + 1,
        ...item,
      }));

      res.json({ data });
    } catch (error) {
      console.error(`Failed to generate ${errorLabel}:`, error);
      res.status(500).json({ error: `Failed to generate ${errorLabel}` });
    }
  };

  app.get("/api/reports/monthly-pm", isAuthenticated, (req, res) =>
    handleMonthlyReportRequest(req, res, { errorLabel: "Monthly PM report" }),
  );

  app.get("/api/reports/monthly-predictive", isAuthenticated, (req, res) =>
    handleMonthlyReportRequest(req, res, {
      defaultMaintenanceType: "Predictive",
      errorLabel: "Monthly Predictive report",
    }),
  );

  app.get("/api/breakdowns", isAuthenticated, async (req, res) => {
    try {
      const rawStartDate = sanitizeDateParam(getQueryValue(req.query.startDate as string | string[] | undefined));
      const rawEndDate = sanitizeDateParam(getQueryValue(req.query.endDate as string | string[] | undefined));
      const lineId = getQueryValue(req.query.lineId as string | string[] | undefined);
      const machineId = getQueryValue(req.query.machineId as string | string[] | undefined);
      const shiftParam = getQueryValue(req.query.shift as string | string[] | undefined);
      const statusParam = getQueryValue(req.query.status as string | string[] | undefined);
      const pageParam = getQueryValue(req.query.page as string | string[] | undefined);
      const pageSizeParam = getQueryValue(req.query.pageSize as string | string[] | undefined);

      let startDate = rawStartDate;
      let endDate = rawEndDate;
      if (startDate && endDate && startDate > endDate) {
        const tmp = startDate;
        startDate = endDate;
        endDate = tmp;
      }

      const normalizedShift = shiftParam ? shiftParam.trim().toUpperCase() : null;
      const allowedShifts = ["A", "B", "C"];
      const shiftFilter = normalizedShift && allowedShifts.includes(normalizedShift) ? normalizedShift : null;

      const normalizedStatus = statusParam ? statusParam.trim().toLowerCase() : null;
      const allowedStatuses = ["open", "closed", "pending"];
      const statusFilter = normalizedStatus && allowedStatuses.includes(normalizedStatus) ? normalizedStatus : null;

      const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : Number.NaN;
      const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const parsedPageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : Number.NaN;
      const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.min(parsedPageSize, 100) : 15;
      const offset = (page - 1) * pageSize;

      const conditions: any[] = [isNull(breakdowns.deletedAt)];
      if (startDate) {
        conditions.push(gte(breakdowns.date, startDate));
      }
      if (endDate) {
        conditions.push(lte(breakdowns.date, endDate));
      }
      if (lineId) {
        conditions.push(eq(breakdowns.lineId, lineId));
      }
      if (machineId) {
        conditions.push(eq(breakdowns.machineId, machineId));
      }
      if (shiftFilter) {
        conditions.push(eq(breakdowns.shift, shiftFilter));
      }
      if (statusFilter) {
        conditions.push(eq(breakdowns.status, statusFilter));
      }

      const whereClause =
        conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);

      const baseQuery = db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          shift: breakdowns.shift,
          line: lines.name,
          machine: machines.name,
          problem: problemTypes.name,
          problemDescription: breakdowns.problemDescription,
          status: breakdowns.status,
          totalMinutes: breakdowns.totalMinutes,
          attendBy: employees.name,
          lineId: breakdowns.lineId,
          subLineId: breakdowns.subLineId,
          machineId: breakdowns.machineId,
          problemTypeId: breakdowns.problemTypeId,
          priority: breakdowns.priority,
          actionTaken: breakdowns.actionTaken,
          rootCause: breakdowns.rootCause,
          startTime: breakdowns.startTime,
          finishTime: breakdowns.finishTime,
          majorContribution: breakdowns.majorContribution,
          majorContributionTime: breakdowns.majorContributionTime,
          attendById: breakdowns.attendById,
          closedById: breakdowns.closedById,
          closedDate: breakdowns.closedDate,
          remark: breakdowns.remark,
          createdAt: breakdowns.createdAt,
          capaRequired: breakdowns.capaRequired,
          capaOperator: breakdowns.capaOperator,
          capaMaintenance: breakdowns.capaMaintenance,
          capaWhatHappened: breakdowns.capaWhatHappened,
          capaFailureMode: breakdowns.capaFailureMode,
          capaSketch: breakdowns.capaSketch,
          capaProblemDescriptions: breakdowns.capaProblemDescriptions,
          capaRootCauses: breakdowns.capaRootCauses,
          capaPreventiveActions: breakdowns.capaPreventiveActions,
          capaPreparedBy: breakdowns.capaPreparedBy,
          capaCheckedBy: breakdowns.capaCheckedBy,
          capaReviewedBy: breakdowns.capaReviewedBy,
        })
        .from(breakdowns)
        .leftJoin(lines, eq(breakdowns.lineId, lines.id))
        .leftJoin(machines, eq(breakdowns.machineId, machines.id))
        .leftJoin(problemTypes, eq(breakdowns.problemTypeId, problemTypes.id))
        .leftJoin(employees, eq(breakdowns.attendById, employees.id));

      const filteredQuery = whereClause ? baseQuery.where(whereClause) : baseQuery;

      const rows = await filteredQuery
        .orderBy(desc(breakdowns.date), desc(breakdowns.startTime))
        .limit(pageSize)
        .offset(offset);

      const countQuery = whereClause
        ? db.select({ count: sql<number>`count(*)` }).from(breakdowns).where(whereClause)
        : db.select({ count: sql<number>`count(*)` }).from(breakdowns).where(isNull(breakdowns.deletedAt));
      const [{ count }] = await countQuery;
      const total = Number(count ?? 0);
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

      res.json({
        items: rows,
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch breakdowns" });
    }
  });

  app.post("/api/breakdowns", isAuthenticated, hasRole("Admin", "Supervisor", "Engineer"), async (req, res) => {
    try {
      const validated = insertBreakdownSchema.parse(req.body);
      const minutesRaw = validated.totalMinutes;
      const minutes = Number(minutesRaw ?? NaN);
      const [selectedProblemType] = validated.problemTypeId
        ? await db
            .select({ name: problemTypes.name })
            .from(problemTypes)
            .where(eq(problemTypes.id, validated.problemTypeId))
            .limit(1)
        : [];
      const isBdProblemType = (selectedProblemType?.name ?? "").trim().toUpperCase() === "B/D";
      const capaRequired =
        Number.isFinite(minutes) && minutes > 45 && isBdProblemType
          ? "yes"
          : validated.capaRequired ?? "no";
      const [breakdown] = await db.insert(breakdowns).values({
        ...validated,
        createdById: (req.user as any).id,
        deletedAt: null,
        capaRequired,
      }).returning();
      res.json(breakdown);
    } catch (error) {
      res.status(400).json({ error: "Invalid breakdown data" });
    }
  });

  app.put("/api/breakdowns/:id", isAuthenticated, hasRole("Admin", "Supervisor", "Engineer"), async (req, res) => {
    try {
      const { id } = req.params;
      const validated = insertBreakdownSchema.parse(req.body);
      const minutesRaw = validated.totalMinutes;
      const minutes = Number(minutesRaw ?? NaN);
      const [selectedProblemType] = validated.problemTypeId
        ? await db
            .select({ name: problemTypes.name })
            .from(problemTypes)
            .where(eq(problemTypes.id, validated.problemTypeId))
            .limit(1)
        : [];
      const isBdProblemType = (selectedProblemType?.name ?? "").trim().toUpperCase() === "B/D";
      const hasMinutes = minutesRaw !== undefined && minutesRaw !== null && minutesRaw !== "";
      const capaRequired =
        Number.isFinite(minutes) && minutes > 45 && isBdProblemType ? "yes" : "no";
      const updatePayload: typeof validated & { capaRequired?: string } = {
        ...validated,
      };
      if (hasMinutes) {
        updatePayload.capaRequired = capaRequired;
      } else {
        delete updatePayload.capaRequired;
      }
      const [breakdown] = await db.update(breakdowns)
        .set(updatePayload)
        .where(eq(breakdowns.id, id))
        .returning();
      
      if (!breakdown) {
        return res.status(404).json({ error: "Breakdown not found" });
      }
      
      res.json(breakdown);
    } catch (error) {
      res.status(400).json({ error: "Invalid breakdown data" });
    }
  });

  app.get("/api/breakdowns/deleted", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const pageParam = getQueryValue(req.query.page as string | string[] | undefined);
      const pageSizeParam = getQueryValue(req.query.pageSize as string | string[] | undefined);
      const parsedPage = pageParam ? Number.parseInt(pageParam, 10) : Number.NaN;
      const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
      const parsedPageSize = pageSizeParam ? Number.parseInt(pageSizeParam, 10) : Number.NaN;
      const pageSize = Number.isFinite(parsedPageSize) && parsedPageSize > 0 ? Math.min(parsedPageSize, 100) : 15;
      const offset = (page - 1) * pageSize;

      const rows = await db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          shift: breakdowns.shift,
          line: lines.name,
          machine: machines.name,
          problem: problemTypes.name,
          problemDescription: breakdowns.problemDescription,
          status: breakdowns.status,
          totalMinutes: breakdowns.totalMinutes,
          attendBy: employees.name,
          lineId: breakdowns.lineId,
          subLineId: breakdowns.subLineId,
          machineId: breakdowns.machineId,
          problemTypeId: breakdowns.problemTypeId,
          priority: breakdowns.priority,
          actionTaken: breakdowns.actionTaken,
          rootCause: breakdowns.rootCause,
          startTime: breakdowns.startTime,
          finishTime: breakdowns.finishTime,
          majorContribution: breakdowns.majorContribution,
          majorContributionTime: breakdowns.majorContributionTime,
          attendById: breakdowns.attendById,
          closedById: breakdowns.closedById,
          closedDate: breakdowns.closedDate,
          remark: breakdowns.remark,
          createdAt: breakdowns.createdAt,
          capaRequired: breakdowns.capaRequired,
          capaOperator: breakdowns.capaOperator,
          capaMaintenance: breakdowns.capaMaintenance,
          capaWhatHappened: breakdowns.capaWhatHappened,
          capaFailureMode: breakdowns.capaFailureMode,
          capaSketch: breakdowns.capaSketch,
          capaProblemDescriptions: breakdowns.capaProblemDescriptions,
          capaRootCauses: breakdowns.capaRootCauses,
          capaPreventiveActions: breakdowns.capaPreventiveActions,
          capaPreparedBy: breakdowns.capaPreparedBy,
          capaCheckedBy: breakdowns.capaCheckedBy,
          capaReviewedBy: breakdowns.capaReviewedBy,
          deletedAt: breakdowns.deletedAt,
        })
        .from(breakdowns)
        .leftJoin(lines, eq(breakdowns.lineId, lines.id))
        .leftJoin(machines, eq(breakdowns.machineId, machines.id))
        .leftJoin(problemTypes, eq(breakdowns.problemTypeId, problemTypes.id))
        .leftJoin(employees, eq(breakdowns.attendById, employees.id))
        .where(isNotNull(breakdowns.deletedAt))
        .orderBy(desc(breakdowns.deletedAt), desc(breakdowns.date))
        .limit(pageSize)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(breakdowns)
        .where(isNotNull(breakdowns.deletedAt));

      const total = Number(count ?? 0);
      const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

      res.json({
        items: rows,
        meta: {
          page,
          pageSize,
          total,
          totalPages,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch deleted breakdowns" });
    }
  });

  app.post("/api/breakdowns/:id/restore", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const [restored] = await db
        .update(breakdowns)
        .set({ deletedAt: null })
        .where(eq(breakdowns.id, id))
        .returning();

      if (!restored) {
        return res.status(404).json({ error: "Breakdown not found" });
      }

      res.json({ message: "Breakdown restored" });
    } catch (error) {
      res.status(500).json({ error: "Failed to restore breakdown" });
    }
  });

  app.delete("/api/breakdowns/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const [deleted] = await db
        .update(breakdowns)
        .set({ deletedAt: new Date() })
        .where(eq(breakdowns.id, id))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Breakdown not found" });
      }

      res.json({ message: "Breakdown deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete breakdown" });
    }
  });

  // Ensure API 404s return JSON instead of the SPA HTML
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "API route not found" });
  });

  const httpServer = createServer(app);

  startMaintenanceScheduler();

  return httpServer;
}









