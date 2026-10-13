import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "worker" && session.role !== "admin")) {
      return NextResponse.json({ error: "Only assigned workers can start this job." }, { status: 403 });
    }

    const { id } = params;

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    if (session.role === "worker" && complaint.assignedWorkerId !== session.userId) {
      return NextResponse.json({ error: "You are not assigned to this job." }, { status: 403 });
    }

    const previousStatus = complaint.status;
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: { status: "IN_PROGRESS" },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session.userId,
        actorRole: session.role,
        type: "STARTED",
        fromStatus: previousStatus,
        toStatus: "IN_PROGRESS",
        note: `Worker ${session.name} arrived on site and started repair work.`,
      },
    });

    if (complaint.citizenId) {
      await db.notification.create({
        data: {
          userId: complaint.citizenId,
          title: `Repair in Progress: ${complaint.trackingId}`,
          body: `Our field team has arrived on site and commenced repairs.`,
          link: `/citizen/complaints/${complaint.trackingId}`,
        },
      });
    }

    return NextResponse.json({ success: true, complaint: updated });
  } catch (error: any) {
    console.error("Start job error:", error);
    return NextResponse.json({ error: "Failed to start job." }, { status: 500 });
  }
}
