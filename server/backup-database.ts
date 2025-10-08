import { db } from "./db";
import { users, employees, lines, subLines, machines, problemTypes, breakdowns } from "@shared/schema";
import { writeFileSync } from "fs";
import { join } from "path";

async function createBackup() {
  console.log("Starting database backup...");
  
  try {
    // Fetch all data from all tables
    const backup = {
      timestamp: new Date().toISOString(),
      users: await db.select({
        id: users.id,
        username: users.username,
        password: users.password,
        name: users.name,
        email: users.email,
        role: users.role
      }).from(users),
      employees: await db.select().from(employees),
      lines: await db.select().from(lines),
      subLines: await db.select().from(subLines),
      machines: await db.select().from(machines),
      problemTypes: await db.select().from(problemTypes),
      breakdowns: await db.select().from(breakdowns)
    };

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = join(process.cwd(), `database-backup-${timestamp}.json`);
    
    // Write backup to file
    writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`✓ Backup created successfully!`);
    console.log(`✓ Location: ${backupPath}`);
    console.log(`✓ Users: ${backup.users.length}`);
    console.log(`✓ Employees: ${backup.employees.length}`);
    console.log(`✓ Lines: ${backup.lines.length}`);
    console.log(`✓ Sub Lines: ${backup.subLines.length}`);
    console.log(`✓ Machines: ${backup.machines.length}`);
    console.log(`✓ Problem Types: ${backup.problemTypes.length}`);
    console.log(`✓ Breakdowns: ${backup.breakdowns.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating backup:", error);
    process.exit(1);
  }
}

createBackup();
