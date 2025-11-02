import { differenceInCalendarDays } from "date-fns";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { maintenanceSchedules, machines, lines } from "@shared/schema";
import { sendMaintenanceEmail } from "./email";

const CHECK_INTERVAL_MS = 60 * 60 * 1000; // hourly

function formatDate(date: string | Date): string {
  const instance = typeof date === "string" ? new Date(date) : date;
  return instance.toISOString().split("T")[0];
}

const DEFAULT_REMINDER_TEMPLATE = `
Hello,

This is a reminder that the machine {{machineName}}{{machineCodeFormatted}} on line {{lineName}} has a scheduled maintenance on {{scheduledDate}}.

Maintenance frequency: {{maintenanceFrequency}}
Notes: {{notes}}

Please ensure the necessary preparations are made.
`;

const DEFAULT_COMPLETION_TEMPLATE = `
Hello,

The maintenance for machine {{machineName}}{{machineCodeFormatted}} on line {{lineName}} has been marked as completed on {{completedDate}}.

Planned maintenance date: {{scheduledDate}}
Maintenance frequency: {{maintenanceFrequency}}
Notes: {{notes}}

Regards,
Maintenance Tracker
`;

function parseRecipients(value?: string | null): string[] {
  if (!value) return [];
  return value
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function renderTemplate(template: string | null | undefined, fallback: string, data: Record<string, string>): string {
  const source = (template && template.trim().length > 0 ? template : fallback).replace(/\r?\n/g, "\n");
  const html = source.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? "");
  return html.split("\n").map((line) => line.trim()).join("<br/>");
}

async function fetchScheduleWithMachine(scheduleId: string) {
  const [result] = await db
    .select({
      id: maintenanceSchedules.id,
      machineId: maintenanceSchedules.machineId,
      scheduledDate: maintenanceSchedules.scheduledDate,
      status: maintenanceSchedules.status,
      maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
      notes: maintenanceSchedules.notes,
      emailRecipients: maintenanceSchedules.emailRecipients,
      emailTemplate: maintenanceSchedules.emailTemplate,
      preNotificationSent: maintenanceSchedules.preNotificationSent,
      updatedAt: maintenanceSchedules.updatedAt,
      completedAt: maintenanceSchedules.completedAt,
      machineName: machines.name,
      machineCodeStored: maintenanceSchedules.machineCode,
      machineCodeDerived: machines.code,
      lineName: lines.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
    .leftJoin(lines, eq(machines.lineId, lines.id))
    .where(eq(maintenanceSchedules.id, scheduleId))
    .limit(1);

  return result;
}

async function sendUpcomingMaintenanceReminders() {
  const today = new Date();

  const schedules = await db
    .select({
      id: maintenanceSchedules.id,
      machineId: maintenanceSchedules.machineId,
      scheduledDate: maintenanceSchedules.scheduledDate,
      maintenanceFrequency: maintenanceSchedules.maintenanceFrequency,
      notes: maintenanceSchedules.notes,
      emailRecipients: maintenanceSchedules.emailRecipients,
      emailTemplate: maintenanceSchedules.emailTemplate,
      machineName: machines.name,
      machineCodeStored: maintenanceSchedules.machineCode,
      machineCodeDerived: machines.code,
      lineName: lines.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(machines, eq(maintenanceSchedules.machineId, machines.id))
    .leftJoin(lines, eq(machines.lineId, lines.id))
    .where(
      and(
        eq(maintenanceSchedules.status, "scheduled"),
        eq(maintenanceSchedules.preNotificationSent, false)
      )
    );

  for (const schedule of schedules) {
    if (!schedule.scheduledDate) {
      continue;
    }

    const scheduledDate = new Date(schedule.scheduledDate as unknown as string);
    const daysUntil = differenceInCalendarDays(scheduledDate, today);

    if (daysUntil !== 1) {
      continue;
    }

    const resolvedCode = schedule.machineCodeStored || schedule.machineCodeDerived || "";
    const machineCodeFormatted = resolvedCode ? ` (Code: ${resolvedCode})` : "";

    const data = {
      machineName: schedule.machineName || "Unknown Machine",
      machineCode: resolvedCode,
      machineCodeFormatted,
      lineName: schedule.lineName || "N/A",
      scheduledDate: formatDate(scheduledDate),
      maintenanceFrequency: schedule.maintenanceFrequency || "Not specified",
      notes: schedule.notes || "None",
      completedDate: "",
    };

    await sendMaintenanceEmail({
      subject: `Maintenance Reminder: ${schedule.machineName} (${resolvedCode || "No Code"})`,
      html: renderTemplate(schedule.emailTemplate, DEFAULT_REMINDER_TEMPLATE, data),
      recipients: parseRecipients(schedule.emailRecipients),
    });

    await db
      .update(maintenanceSchedules)
      .set({ preNotificationSent: true, updatedAt: new Date() })
      .where(eq(maintenanceSchedules.id, schedule.id));
  }
}

export async function sendMaintenanceCompletionNotification(scheduleId: string) {
  const schedule = await fetchScheduleWithMachine(scheduleId);
  if (!schedule) {
    return;
  }

  const completedDate = schedule.completedAt ? new Date(schedule.completedAt) : new Date();
  const resolvedCode = schedule.machineCodeStored || schedule.machineCodeDerived || "";
  const machineCodeFormatted = resolvedCode ? ` (Code: ${resolvedCode})` : "";

  const data = {
    machineName: schedule.machineName || "Unknown Machine",
    machineCode: resolvedCode,
    machineCodeFormatted,
    lineName: schedule.lineName || "N/A",
    scheduledDate: formatDate(schedule.scheduledDate as unknown as string),
    maintenanceFrequency: schedule.maintenanceFrequency || "Not specified",
    notes: schedule.notes || "None",
    completedDate: formatDate(completedDate),
  };

  await sendMaintenanceEmail({
    subject: `Maintenance Completed: ${schedule.machineName} (${resolvedCode || "No Code"})`,
    html: renderTemplate(schedule.emailTemplate, DEFAULT_COMPLETION_TEMPLATE, data),
    recipients: parseRecipients(schedule.emailRecipients),
  });
}

let schedulerStarted = false;

export function startMaintenanceScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const run = async () => {
    try {
      await sendUpcomingMaintenanceReminders();
    } catch (error) {
      console.error("[maintenance-scheduler] Failed to process reminders:", error);
    }
  };

  void run();
  setInterval(run, CHECK_INTERVAL_MS);
}








