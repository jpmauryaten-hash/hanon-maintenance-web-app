import { db } from "./db";
import { users, employees, lines, subLines, machines, problemTypes, breakdowns } from "@shared/schema";
import { readFileSync } from "fs";
import { sql } from "drizzle-orm";

async function restoreBackup(backupFile: string) {
  console.log(`Starting database restore from: ${backupFile}`);
  
  try {
    // Read backup file
    const backupData = JSON.parse(readFileSync(backupFile, "utf-8"));
    console.log(`Backup timestamp: ${backupData.timestamp}`);
    
    // Clear existing data (in reverse order due to foreign keys)
    console.log("Clearing existing data...");
    await db.delete(breakdowns);
    await db.delete(machines);
    await db.delete(problemTypes);
    await db.delete(subLines);
    await db.delete(lines);
    await db.delete(employees);
    await db.delete(users);
    console.log("✓ Existing data cleared");
    
    // Restore data
    if (backupData.users.length > 0) {
      await db.insert(users).values(backupData.users);
      console.log(`✓ Restored ${backupData.users.length} users`);
    }
    
    if (backupData.employees.length > 0) {
      await db.insert(employees).values(backupData.employees);
      console.log(`✓ Restored ${backupData.employees.length} employees`);
    }
    
    if (backupData.lines.length > 0) {
      await db.insert(lines).values(backupData.lines);
      console.log(`✓ Restored ${backupData.lines.length} lines`);
    }
    
    if (backupData.subLines.length > 0) {
      await db.insert(subLines).values(backupData.subLines);
      console.log(`✓ Restored ${backupData.subLines.length} sub lines`);
    }
    
    if (backupData.machines.length > 0) {
      await db.insert(machines).values(backupData.machines);
      console.log(`✓ Restored ${backupData.machines.length} machines`);
    }
    
    if (backupData.problemTypes.length > 0) {
      await db.insert(problemTypes).values(backupData.problemTypes);
      console.log(`✓ Restored ${backupData.problemTypes.length} problem types`);
    }
    
    if (backupData.breakdowns.length > 0) {
      await db.insert(breakdowns).values(backupData.breakdowns);
      console.log(`✓ Restored ${backupData.breakdowns.length} breakdowns`);
    }
    
    console.log("Database restore completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error restoring backup:", error);
    process.exit(1);
  }
}

// Get backup file from command line argument
const backupFile = process.argv[2];
if (!backupFile) {
  console.error("Usage: tsx server/restore-database.ts <backup-file.json>");
  process.exit(1);
}

restoreBackup(backupFile);
