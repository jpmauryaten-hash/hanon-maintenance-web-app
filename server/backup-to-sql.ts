import { db } from "./db";
import { users, employees, lines, subLines, machines, problemTypes, breakdowns } from "@shared/schema";
import { writeFileSync } from "fs";
import { join } from "path";

function escapeString(str: string | null | undefined): string {
  if (str === null || str === undefined) return 'NULL';
  return `'${str.replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number') return value.toString();
  if (value instanceof Date) return escapeString(value.toISOString());
  if (typeof value === 'object') return escapeString(JSON.stringify(value));
  return escapeString(value.toString());
}

async function createSQLBackup() {
  console.log("Starting SQL backup...");
  
  try {
    let sql = `-- PostgreSQL Database Backup
-- Generated on: ${new Date().toISOString()}
-- Database: Breakdown Tracker

-- Disable triggers during restore
SET session_replication_role = replica;

-- Clear existing data (in reverse order due to foreign keys)
TRUNCATE TABLE breakdowns CASCADE;
TRUNCATE TABLE machines CASCADE;
TRUNCATE TABLE problem_types CASCADE;
TRUNCATE TABLE sub_lines CASCADE;
TRUNCATE TABLE lines CASCADE;
TRUNCATE TABLE employees CASCADE;
TRUNCATE TABLE users CASCADE;

`;

    // Backup users
    const usersData = await db.select().from(users);
    console.log(`Backing up ${usersData.length} users...`);
    if (usersData.length > 0) {
      sql += `\n-- Users\n`;
      for (const user of usersData) {
        sql += `INSERT INTO users (id, username, password, name, email, role) VALUES (${formatValue(user.id)}, ${formatValue(user.username)}, ${formatValue(user.password)}, ${formatValue(user.name)}, ${formatValue(user.email)}, ${formatValue(user.role)});\n`;
      }
    }

    // Backup employees
    const employeesData = await db.select().from(employees);
    console.log(`Backing up ${employeesData.length} employees...`);
    if (employeesData.length > 0) {
      sql += `\n-- Employees\n`;
      for (const emp of employeesData) {
        sql += `INSERT INTO employees (id, name, role, department) VALUES (${formatValue(emp.id)}, ${formatValue(emp.name)}, ${formatValue(emp.role)}, ${formatValue(emp.department)});\n`;
      }
    }

    // Backup lines
    const linesData = await db.select().from(lines);
    console.log(`Backing up ${linesData.length} lines...`);
    if (linesData.length > 0) {
      sql += `\n-- Lines\n`;
      for (const line of linesData) {
        sql += `INSERT INTO lines (id, name, description) VALUES (${formatValue(line.id)}, ${formatValue(line.name)}, ${formatValue(line.description)});\n`;
      }
    }

    // Backup sub_lines
    const subLinesData = await db.select().from(subLines);
    console.log(`Backing up ${subLinesData.length} sub lines...`);
    if (subLinesData.length > 0) {
      sql += `\n-- Sub Lines\n`;
      for (const subLine of subLinesData) {
        sql += `INSERT INTO sub_lines (id, name, line_id) VALUES (${formatValue(subLine.id)}, ${formatValue(subLine.name)}, ${formatValue(subLine.lineId)});\n`;
      }
    }

    // Backup machines
    const machinesData = await db.select().from(machines);
    console.log(`Backing up ${machinesData.length} machines...`);
    if (machinesData.length > 0) {
      sql += `\n-- Machines\n`;
      for (const machine of machinesData) {
        sql += `INSERT INTO machines (id, name, line_id, sub_line_id, type) VALUES (${formatValue(machine.id)}, ${formatValue(machine.name)}, ${formatValue(machine.lineId)}, ${formatValue(machine.subLineId)}, ${formatValue(machine.type)});\n`;
      }
    }

    // Backup problem_types
    const problemTypesData = await db.select().from(problemTypes);
    console.log(`Backing up ${problemTypesData.length} problem types...`);
    if (problemTypesData.length > 0) {
      sql += `\n-- Problem Types\n`;
      for (const pt of problemTypesData) {
        sql += `INSERT INTO problem_types (id, name, description) VALUES (${formatValue(pt.id)}, ${formatValue(pt.name)}, ${formatValue(pt.description)});\n`;
      }
    }

    // Backup breakdowns
    const breakdownsData = await db.select().from(breakdowns);
    console.log(`Backing up ${breakdownsData.length} breakdowns...`);
    if (breakdownsData.length > 0) {
      sql += `\n-- Breakdowns\n`;
      for (const breakdown of breakdownsData) {
        sql += `INSERT INTO breakdowns (id, date, shift, line_id, sub_line_id, machine_id, problem_type_id, problem_description, start_time, end_time, total_time, attendees, closer, status, priority, capa_required, capa_data, five_why_analysis, root_causes, preventive_actions, prepared_by, approved_by, target_date, completion_date, evidence_before, evidence_after) VALUES (${formatValue(breakdown.id)}, ${formatValue(breakdown.date)}, ${formatValue(breakdown.shift)}, ${formatValue(breakdown.lineId)}, ${formatValue(breakdown.subLineId)}, ${formatValue(breakdown.machineId)}, ${formatValue(breakdown.problemTypeId)}, ${formatValue(breakdown.problemDescription)}, ${formatValue(breakdown.startTime)}, ${formatValue(breakdown.endTime)}, ${formatValue(breakdown.totalTime)}, ${formatValue(breakdown.attendees)}, ${formatValue(breakdown.closer)}, ${formatValue(breakdown.status)}, ${formatValue(breakdown.priority)}, ${formatValue(breakdown.capaRequired)}, ${formatValue(breakdown.capaData)}, ${formatValue(breakdown.fiveWhyAnalysis)}, ${formatValue(breakdown.rootCauses)}, ${formatValue(breakdown.preventiveActions)}, ${formatValue(breakdown.preparedBy)}, ${formatValue(breakdown.approvedBy)}, ${formatValue(breakdown.targetDate)}, ${formatValue(breakdown.completionDate)}, ${formatValue(breakdown.evidenceBefore)}, ${formatValue(breakdown.evidenceAfter)});\n`;
      }
    }

    sql += `\n-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Backup completed successfully
`;

    // Create backup filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const backupPath = join(process.cwd(), `database-backup-${timestamp}.sql`);
    
    // Write backup to file
    writeFileSync(backupPath, sql);
    
    console.log(`\n✓ SQL Backup created successfully!`);
    console.log(`✓ Location: ${backupPath}`);
    console.log(`✓ File size: ${(sql.length / 1024).toFixed(2)} KB`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error creating SQL backup:", error);
    process.exit(1);
  }
}

createSQLBackup();
