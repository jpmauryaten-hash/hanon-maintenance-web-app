import type { Express, Request } from "express";
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
  employees,
  maintenanceSchedules,
  maintenanceScheduleHistory,
  maintenanceYearlyPlans,
  type InsertMaintenanceYearlyPlan,
} from "@shared/schema";
import { insertBreakdownSchema } from "@shared/schema";
import { eq, and, sql, inArray, asc } from "drizzle-orm";
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
      const { machineId, scheduledDate, maintenanceFrequency, notes, emailRecipients, emailTemplate, machineCode: requestMachineCode, shift: requestedShift } = req.body ?? {};

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

      const [created] = await db
        .insert(maintenanceSchedules)
        .values({
          machineId,
          scheduledDate: formattedDate,
          shift: finalShift,
          maintenanceFrequency: finalFrequency || null,
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

  // Employees
  app.post("/api/employees", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { name, department, role } = req.body;
      const [employee] = await db.insert(employees).values({ name, department, role }).returning();
      res.json(employee);
    } catch (error) {
      res.status(400).json({ error: "Failed to create employee" });
    }
  });

  app.put("/api/employees/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, department, role } = req.body;
      const [employee] = await db.update(employees)
        .set({ name, department, role })
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
      const { name, description } = req.body;
      const [problemType] = await db.insert(problemTypes).values({ name, description }).returning();
      res.json(problemType);
    } catch (error) {
      res.status(400).json({ error: "Failed to create problem type" });
    }
  });

  app.put("/api/problem-types/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const [problemType] = await db.update(problemTypes)
        .set({ name, description })
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

  app.get("/api/breakdowns", isAuthenticated, async (req, res) => {
    try {
      const allBreakdowns = await db
        .select({
          id: breakdowns.id,
          date: breakdowns.date,
          shift: breakdowns.shift,
          line: lines.name,
          machine: machines.name,
          problem: problemTypes.name,
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
      
      res.json(allBreakdowns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch breakdowns" });
    }
  });

  app.post("/api/breakdowns", isAuthenticated, hasRole("Admin", "Supervisor", "Engineer"), async (req, res) => {
    try {
      const validated = insertBreakdownSchema.parse(req.body);
      const [breakdown] = await db.insert(breakdowns).values({
        ...validated,
        createdById: (req.user as any).id
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
      const [breakdown] = await db.update(breakdowns)
        .set(validated)
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

  app.delete("/api/breakdowns/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(breakdowns).where(eq(breakdowns.id, id));
      res.json({ message: "Breakdown deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete breakdown" });
    }
  });

  const httpServer = createServer(app);

  startMaintenanceScheduler();

  return httpServer;
}









