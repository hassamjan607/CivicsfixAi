import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { sendEmailAsync } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "officer" && session.role !== "admin")) {
      return NextResponse.json({ error: "Only department officers can assign work orders." }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { workerId, instructions } = body;

    if (!workerId) {
      return NextResponse.json({ error: "Worker ID is required for assignment." }, { status: 400 });
    }

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
      include: { department: true, citizen: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    // Ensure officer belongs to same department (unless admin)
    if (session.role === "officer" && complaint.departmentId !== session.departmentId) {
      return NextResponse.json({ error: "You cannot assign complaints outside your department." }, { status: 403 });
    }

    // Verify worker exists and belongs to the same department
    const worker = await db.user.findFirst({
      where: { id: workerId, role: "worker", active: true },
    });

    if (!worker) {
      return NextResponse.json({ error: "Specified worker not found or inactive." }, { status: 404 });
    }

    if (complaint.departmentId && worker.departmentId !== complaint.departmentId) {
      return NextResponse.json({ error: "Worker must belong to the same municipal department." }, { status: 400 });
    }

    const previousStatus = complaint.status;
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: {
        status: "ASSIGNED",
        assignedWorkerId: worker.id,
        assignedOfficerId: session.userId,
      },
    });

    // Write audit event
    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session.userId,
        actorRole: session.role,
        type: "ASSIGNED",
        fromStatus: previousStatus,
        toStatus: "ASSIGNED",
        note: instructions ? `Assigned to ${worker.name}. Instructions: ${instructions}` : `Assigned to ${worker.name}`,
      },
    });

    // 1. Notify Worker via Email & In-App
    if (worker.email) {
      sendEmailAsync({
        to: worker.email,
        subject: `New job assigned: ${complaint.trackingId}`,
        template: "worker_assigned_worker",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          category: complaint.category,
          address: complaint.address || "Assigned location",
          officerInstructions: instructions || "Inspect site and resolve issue.",
          slaDeadline: complaint.slaDueAt ? new Date(complaint.slaDueAt).toLocaleString() : "Today",
          language: (worker.language as "en" | "ur") || "en",
        },
      });
    }

    await db.notification.create({
      data: {
        userId: worker.id,
        title: `New Task Assigned: ${complaint.trackingId}`,
        body: `${complaint.category} at ${complaint.address || "location"}. Assigned by ${session.name}.`,
        link: `/worker/jobs/${complaint.trackingId}`,
      },
    });

    // 2. Notify Citizen via Email & In-App
    const citizenEmail = complaint.citizen?.email || (complaint.guestContact?.includes("@") ? complaint.guestContact : null);
    if (citizenEmail) {
      sendEmailAsync({
        to: citizenEmail,
        subject: `A team member has been assigned to ${complaint.trackingId}`,
        template: "worker_assigned_citizen",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          workerName: worker.name.split(" ")[0], // First name only as required
          departmentName: complaint.department?.name || "Municipal Team",
          slaDeadline: complaint.slaDueAt ? new Date(complaint.slaDueAt).toLocaleString() : "Active schedule",
          language: (complaint.language as "en" | "ur") || "en",
        },
      });
    }

    if (complaint.citizenId) {
      await db.notification.create({
        data: {
          userId: complaint.citizenId,
          title: `Field Worker Dispatched: ${complaint.trackingId}`,
          body: `${worker.name.split(" ")[0]} from ${complaint.department?.name || "department"} has been assigned to your issue.`,
          link: `/citizen/complaints/${complaint.trackingId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Work order assigned to ${worker.name}`,
      complaint: updated,
    });
  } catch (error: any) {
    console.error("Assign worker error:", error);
    return NextResponse.json({ error: "Failed to assign worker." }, { status: 500 });
  }
}
