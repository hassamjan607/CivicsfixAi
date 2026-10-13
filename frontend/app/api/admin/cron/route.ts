import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendEmailAsync } from "@/lib/email";

export async function POST() {
  try {
    const now = new Date();
    const autoCloseDays = parseInt(process.env.AUTO_CLOSE_DAYS || "7", 10);
    const autoCloseThreshold = new Date(now.getTime() - autoCloseDays * 24 * 3600 * 1000);
    const reminder48hThreshold = new Date(now.getTime() - 48 * 3600 * 1000);

    const results = {
      slaBreached: 0,
      remindersSent: 0,
      autoClosed: 0,
    };

    // 1. SLA Breach Check
    const overdueComplaints = await db.complaint.findMany({
      where: {
        slaDueAt: { lt: now },
        status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
        escalated: false,
      },
      include: { department: true },
    });

    for (const c of overdueComplaints) {
      await db.complaint.update({
        where: { id: c.id },
        data: { escalated: true },
      });

      await db.complaintEvent.create({
        data: {
          complaintId: c.id,
          actorId: null,
          actorRole: "system",
          type: "ESCALATED",
          fromStatus: c.status,
          toStatus: c.status,
          note: `SLA breach detected by system cron. Ticket marked overdue and escalated.`,
        },
      });

      // Email alert to department
      if (c.department?.contactEmail) {
        sendEmailAsync({
          to: c.department.contactEmail,
          subject: `[SLA BREACH ALERT] Complaint Overdue: ${c.trackingId}`,
          template: "sla_breached",
          complaintId: c.id,
          data: {
            trackingId: c.trackingId,
            departmentName: c.department.name,
            urgency: c.urgency,
            language: "en",
          },
        });
      }

      results.slaBreached += 1;
    }

    // 2. Auto-Close: Resolved complaints with no response after AUTO_CLOSE_DAYS
    const staleResolved = await db.complaint.findMany({
      where: {
        status: "RESOLVED",
        updatedAt: { lt: autoCloseThreshold },
      },
      include: { citizen: true },
    });

    for (const c of staleResolved) {
      await db.complaint.update({
        where: { id: c.id },
        data: { status: "CONFIRMED" },
      });

      await db.complaintEvent.create({
        data: {
          complaintId: c.id,
          actorId: null,
          actorRole: "system",
          type: "CONFIRMED",
          fromStatus: "RESOLVED",
          toStatus: "CONFIRMED",
          note: `Auto-closed after ${autoCloseDays} days without citizen objection.`,
        },
      });

      const citizenEmail = c.citizen?.email || (c.guestContact?.includes("@") ? c.guestContact : null);
      if (citizenEmail) {
        sendEmailAsync({
          to: citizenEmail,
          subject: `Complaint Closed (Auto-Close): ${c.trackingId}`,
          template: "complaint_confirmed_citizen",
          complaintId: c.id,
          data: {
            trackingId: c.trackingId,
            language: (c.language as "en" | "ur") || "en",
          },
        });
      }

      results.autoClosed += 1;
    }

    // 3. 48-Hour Reminder for Citizen
    const pendingConfirmation = await db.complaint.findMany({
      where: {
        status: "RESOLVED",
        updatedAt: { lt: reminder48hThreshold, gt: autoCloseThreshold },
      },
      include: { citizen: true },
      take: 10,
    });

    for (const c of pendingConfirmation) {
      const citizenEmail = c.citizen?.email || (c.guestContact?.includes("@") ? c.guestContact : null);
      if (citizenEmail) {
        sendEmailAsync({
          to: citizenEmail,
          subject: `Reminder: Was your issue fixed? (${c.trackingId})`,
          template: "citizen_reminder_48h",
          complaintId: c.id,
          data: {
            trackingId: c.trackingId,
            language: (c.language as "en" | "ur") || "en",
          },
        });
        results.remindersSent += 1;
      }
    }

    return NextResponse.json({ success: true, timestamp: now.toISOString(), results });
  } catch (error: any) {
    console.error("Cron handler error:", error);
    return NextResponse.json({ error: "Background cron tasks failed." }, { status: 500 });
  }
}
