import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { sendEmailAsync } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    const { id } = params;
    const body = await req.json();
    const { reason, photoUrl } = body;

    if (!reason || !reason.trim()) {
      return NextResponse.json(
        { error: "A clear reason is required explaining why the issue is still unresolved." },
        { status: 400 }
      );
    }

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
      include: {
        department: true,
        assignedOfficer: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    if (session && session.role === "citizen" && complaint.citizenId !== session.userId) {
      return NextResponse.json({ error: "You can only reopen your own complaints." }, { status: 403 });
    }

    const previousStatus = complaint.status;

    // Create Feedback record
    await db.feedback.create({
      data: {
        complaintId: complaint.id,
        citizenId: session?.userId || complaint.citizenId || null,
        satisfied: false,
        rating: 1,
        reason: reason.trim(),
        photoUrl: photoUrl || null,
      },
    });

    // Update status to REOPENED and flag escalated
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: {
        status: "REOPENED",
        reopenCount: complaint.reopenCount + 1,
        escalated: true,
      },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session?.userId || complaint.citizenId || null,
        actorRole: session?.role || "citizen",
        type: "REOPENED",
        fromStatus: previousStatus,
        toStatus: "REOPENED",
        note: `Complaint reopened by citizen: "${reason.trim()}". Returned to department queue.`,
      },
    });

    // 1. Alert Officer
    if (complaint.assignedOfficer?.email) {
      sendEmailAsync({
        to: complaint.assignedOfficer.email,
        subject: `[REOPENED] Issue Reported Not Fixed: ${complaint.trackingId}`,
        template: "complaint_reopened",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          reopenReason: reason.trim(),
          language: "en",
        },
      });
    } else if (complaint.department?.contactEmail) {
      sendEmailAsync({
        to: complaint.department.contactEmail,
        subject: `[REOPENED] Issue Reported Not Fixed: ${complaint.trackingId}`,
        template: "complaint_reopened",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          reopenReason: reason.trim(),
          language: "en",
        },
      });
    }

    if (complaint.assignedOfficerId) {
      await db.notification.create({
        data: {
          userId: complaint.assignedOfficerId,
          title: `Ticket Reopened by Citizen: ${complaint.trackingId}`,
          body: `Citizen noted: "${reason.trim().slice(0, 80)}"`,
          link: `/officer/complaints/${complaint.trackingId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Complaint has been reopened and dispatched to department supervisor.",
      complaint: updated,
    });
  } catch (error: any) {
    console.error("Reopen complaint error:", error);
    return NextResponse.json({ error: "Failed to reopen complaint." }, { status: 500 });
  }
}
