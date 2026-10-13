import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { sendEmailAsync } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "worker" && session.role !== "admin")) {
      return NextResponse.json({ error: "Only assigned field staff can mark jobs as resolved." }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { afterPhotoUrl, note, materials, lat, lng } = body;

    // After photo is MANDATORY according to specification Section 3.6 & 4.4
    if (!afterPhotoUrl || !afterPhotoUrl.trim()) {
      return NextResponse.json(
        { error: "Photographic proof of repair ('after' photo) is strictly required to resolve the issue." },
        { status: 400 }
      );
    }

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
      include: {
        department: true,
        citizen: true,
        assignedOfficer: true,
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    if (session.role === "worker" && complaint.assignedWorkerId !== session.userId) {
      return NextResponse.json({ error: "You are not assigned to this work order." }, { status: 403 });
    }

    const previousStatus = complaint.status;

    // Create Proof record
    await db.proof.create({
      data: {
        complaintId: complaint.id,
        workerId: session.userId,
        afterPhotoUrl,
        note: note || "Work completed on site by field specialist.",
        materials: materials || null,
        lat: lat || complaint.lat || null,
        lng: lng || complaint.lng || null,
      },
    });

    // Update status to RESOLVED
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: { status: "RESOLVED" },
    });

    // Write audit event
    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session.userId,
        actorRole: session.role,
        type: "RESOLVED",
        fromStatus: previousStatus,
        toStatus: "RESOLVED",
        note: `Work completed by ${session.name}. Photographic proof attached. Note: ${note || "None"}`,
      },
    });

    // 1. Notify Citizen with Before/After photos and one-click Confirm/Reopen buttons
    const citizenEmail = complaint.citizen?.email || (complaint.guestContact?.includes("@") ? complaint.guestContact : null);
    if (citizenEmail) {
      sendEmailAsync({
        to: citizenEmail,
        subject: `Your issue was marked as fixed. Please confirm (${complaint.trackingId})`,
        template: "complaint_resolved_citizen",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          workerName: session.name.split(" ")[0],
          afterPhotoUrl,
          language: (complaint.language as "en" | "ur") || "en",
        },
      });
    }

    if (complaint.citizenId) {
      await db.notification.create({
        data: {
          userId: complaint.citizenId,
          title: `Action Required: Confirm Repair for ${complaint.trackingId}`,
          body: `Our crew marked this issue as fixed. Tap to verify if the work is satisfactory.`,
          link: `/citizen/complaints/${complaint.trackingId}`,
        },
      });
    }

    // 2. Notify Officer
    if (complaint.assignedOfficer?.email) {
      sendEmailAsync({
        to: complaint.assignedOfficer.email,
        subject: `${complaint.trackingId} resolved by ${session.name}`,
        template: "complaint_resolved_officer",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          workerName: session.name,
          afterPhotoUrl,
          language: "en",
        },
      });
    }

    if (complaint.assignedOfficerId) {
      await db.notification.create({
        data: {
          userId: complaint.assignedOfficerId,
          title: `Job Resolved by Worker: ${complaint.trackingId}`,
          body: `${session.name} completed work. Awaiting citizen confirmation.`,
          link: `/officer/complaints/${complaint.trackingId}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Work order resolved and proof uploaded. Citizen notified for verification.",
      complaint: updated,
    });
  } catch (error: any) {
    console.error("Resolve job error:", error);
    return NextResponse.json({ error: "Failed to mark job as resolved." }, { status: 500 });
  }
}
