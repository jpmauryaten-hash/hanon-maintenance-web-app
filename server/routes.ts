import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { passport, isAuthenticated, hasRole } from "./auth";
import { users, breakdowns, lines, subLines, machines, problemTypes, employees, maintenanceSchedules, maintenanceYearlyPlans, type InsertMaintenanceYearlyPlan } from "@shared/schema";
import { insertBreakdownSchema } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import bcrypt from "bcrypt";
import { startMaintenanceScheduler, sendMaintenanceCompletionNotification } from "./maintenance-scheduler";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to sanitize user object (remove password)
  const sanitizeUser = (user: any) => {
    const { password, ...safeUser } = user;
    return safeUser;
  };

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
    return result;
  };

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
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id));

      res.json(schedules.map(formatMaintenanceSchedule));
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
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .where(eq(maintenanceSchedules.id, created.id))
        .limit(1);

      res.json(formatMaintenanceSchedule(schedule));
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
      const { scheduledDate, maintenanceFrequency, notes, status, emailRecipients, emailTemplate, machineCode: updatedMachineCode, shift: updatedShift } = req.body ?? {}; 

      const updates: Record<string, any> = { updatedAt: new Date() };

      if (scheduledDate) {
        const parsedDate = new Date(scheduledDate);
        if (Number.isNaN(parsedDate.getTime())) {
          return res.status(400).json({ error: "Invalid scheduled date" });
        }
        updates.scheduledDate = parsedDate.toISOString().split("T")[0];
        updates.preNotificationSent = false;
      }

      if (maintenanceFrequency !== undefined) {
        const trimmed = String(maintenanceFrequency || "").trim();
        updates.maintenanceFrequency = trimmed || null;
      }

      if (notes !== undefined) {
        const trimmedNotes = String(notes || "").trim();
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

      const [updated] = await db
        .update(maintenanceSchedules)
        .set(updates)
        .where(eq(maintenanceSchedules.id, id))
        .returning({ id: maintenanceSchedules.id });

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
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .where(eq(maintenanceSchedules.id, updated.id))
        .limit(1);

      res.json(formatMaintenanceSchedule(schedule));
    } catch (error) {
      console.error("Failed to update maintenance plan:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to update maintenance plan";
      res.status(500).json({ error: message });
    }
  });

  app.post("/api/maintenance-plans/:id/complete", isAuthenticated, hasRole("Admin", "Supervisor"), async (req, res) => {
    try {
      const { id } = req.params;

      const [updated] = await db
        .update(maintenanceSchedules)
        .set({
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
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
          preNotificationSent: maintenanceSchedules.preNotificationSent,
          createdAt: maintenanceSchedules.createdAt,
          updatedAt: maintenanceSchedules.updatedAt,
          completedAt: maintenanceSchedules.completedAt,
          machineName: machines.name,
          lineName: lines.name,
        })
        .from(maintenanceSchedules)
        .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
        .leftJoin(lines, eq(machines.lineId, lines.id))
        .where(eq(maintenanceSchedules.id, updated.id))
        .limit(1);

      res.json(formatMaintenanceSchedule(schedule));
    } catch (error) {
      console.error("Failed to complete maintenance plan:", error);
      const message =
        error instanceof Error && error.message ? error.message : "Failed to complete maintenance plan";
      res.status(500).json({ error: message });
    }
  });

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









