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
  // Master Data CRUD Routes
  
  // Lines
  app.post("/api/lines", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { name, description } = req.body;
      const [line] = await db.insert(lines).values({ name, description }).returning();
      res.json(line);
    } catch (error) {
      res.status(400).json({ error: "Failed to create line" });
    }
  });

  app.put("/api/lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;
      const [line] = await db.update(lines)
        .set({ name, description })
        .where(eq(lines.id, id))
        .returning();
      
      if (!line) {
        return res.status(404).json({ error: "Line not found" });
      }
      res.json(line);
    } catch (error) {
      res.status(400).json({ error: "Failed to update line" });
    }
  });

  app.delete("/api/lines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(lines).where(eq(lines.id, id));
      res.json({ message: "Line deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete line" });
    }
  });

  // Machines
  app.post("/api/machines", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { name, lineId, subLineId, type } = req.body;
      const [machine] = await db.insert(machines).values({ name, lineId, subLineId, type }).returning();
      res.json(machine);
    } catch (error) {
      res.status(400).json({ error: "Failed to create machine" });
    }
  });

  app.put("/api/machines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      const { name, lineId, subLineId, type } = req.body;
      const [machine] = await db.update(machines)
        .set({ name, lineId, subLineId, type })
        .where(eq(machines.id, id))
        .returning();
      
      if (!machine) {
        return res.status(404).json({ error: "Machine not found" });
      }
      res.json(machine);
    } catch (error) {
      res.status(400).json({ error: "Failed to update machine" });
    }
  });

  app.delete("/api/machines/:id", isAuthenticated, hasRole("Admin"), async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(machines).where(eq(machines.id, id));
      res.json({ message: "Machine deleted" });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete machine" });
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
