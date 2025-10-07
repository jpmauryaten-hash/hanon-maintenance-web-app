import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "./db";
import { passport, isAuthenticated, hasRole } from "./auth";
import { users, breakdowns, lines, subLines, machines, problemTypes, employees } from "@shared/schema";
import { insertBreakdownSchema } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // Helper to sanitize user object (remove password)
  const sanitizeUser = (user: any) => {
    const { password, ...safeUser } = user;
    return safeUser;
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

  // Breakdown routes
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

  return httpServer;
}
