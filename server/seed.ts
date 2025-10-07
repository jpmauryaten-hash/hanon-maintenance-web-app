import { db } from "./db";
import { users, employees, lines, subLines, machines, problemTypes } from "@shared/schema";
import bcrypt from "bcrypt";
import { readFileSync } from "fs";
import { join } from "path";

// Load master data from JSON file
let MASTER_DATA: any;
try {
  const jsonPath = join(process.cwd(), "attached_assets", "masters_seed_1759853208471.json");
  MASTER_DATA = JSON.parse(readFileSync(jsonPath, "utf-8"));
  console.log("Loaded master data from JSON file");
} catch (error) {
  console.error("Failed to load master data JSON, using defaults");
  MASTER_DATA = {
    lines: ["FRONT LINE", "FT & MANIFOLD  LINE", "IMM & PRESS SHOP"],
    sub_lines: ["AC LINE", "CAB LINE", "CAC LINE"],
    machines: ["CORE BUILDER -5 MATRIX (RAD)", "FIN MILL -2"],
    problem_types: ["B/D", "SAFETY /OTHER"],
    attendees: ["ADITYA", "AKHIL"],
    closers: ["AKHIL", "HARSH"]
  };
}

export async function seedDatabase() {
  console.log("Starting database seed...");

  // Check if admin user already exists
  const existingAdmin = await db.query.users.findFirst({
    where: (users, { eq }) => eq(users.username, "admin"),
  });

  if (existingAdmin) {
    console.log("Database already seeded. Skipping...");
    return;
  }

  try {
    // Create admin user
    const hashedPassword = await bcrypt.hash("admin123", 10);
    await db.insert(users).values({
      username: "admin",
      password: hashedPassword,
      name: "Admin User",
      email: "admin@example.com",
      role: "Admin",
    });
    console.log("✓ Created admin user (admin/admin123)");

    // Create sample users
    const engineerPassword = await bcrypt.hash("engineer123", 10);
    await db.insert(users).values({
      username: "engineer",
      password: engineerPassword,
      name: "John Doe",
      email: "engineer@example.com",
      role: "Engineer",
    });
    console.log("✓ Created engineer user");

    // Create lines
    const lineRecords = await db.insert(lines).values(
      MASTER_DATA.lines.map(name => ({ name, description: `${name} production line` }))
    ).returning();
    console.log(`✓ Created ${lineRecords.length} lines`);

    // Create sub lines (assign to first line for now)
    const subLineRecords = await db.insert(subLines).values(
      MASTER_DATA.sub_lines.map(name => ({ 
        name, 
        lineId: lineRecords[0].id 
      }))
    ).returning();
    console.log(`✓ Created ${subLineRecords.length} sub lines`);

    // Create machines
    const machineRecords = await db.insert(machines).values(
      MASTER_DATA.machines.map(name => ({
        name,
        lineId: lineRecords[0].id,
        type: "Production Machine"
      }))
    ).returning();
    console.log(`✓ Created ${machineRecords.length} machines`);

    // Create problem types
    const problemTypeRecords = await db.insert(problemTypes).values(
      MASTER_DATA.problem_types.map(name => ({ name, description: name }))
    ).returning();
    console.log(`✓ Created ${problemTypeRecords.length} problem types`);

    // Create employees from both attendees and closers lists (combined and deduplicated)
    const allEmployees = Array.from(new Set([
      ...(MASTER_DATA.attendees || []),
      ...(MASTER_DATA.closers || [])
    ]));
    
    const employeeRecords = await db.insert(employees).values(
      allEmployees.map((name: string) => ({
        name,
        department: "Maintenance",
        role: "Technician"
      }))
    ).returning();
    console.log(`✓ Created ${employeeRecords.length} employees`);

    console.log("Database seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}
