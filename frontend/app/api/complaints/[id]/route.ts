import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required to view complaint details." }, { status: 401 });
    }

    const { id } = params;

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [
          { id },
          { trackingId: id },
          { trackingId: id.toUpperCase() },
        ],
      },
      include: {
        department: true,
        citizen: { select: { id: true, name: true, email: true } },
        assignedOfficer: { select: { id: true, name: true, role: true } },
        assignedWorker: { select: { id: true, name: true, role: true } },
        events: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
        },
        proofs: {
          include: { worker: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        feedbacks: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    // Server-side authorization check
    if (session.role === "citizen" && complaint.citizenId !== session.userId) {
      return NextResponse.json({ error: "Access denied: you can only view your own complaints." }, { status: 403 });
    }
    if (session.role === "officer" && complaint.departmentId !== session.departmentId) {
      return NextResponse.json({ error: "Access denied: this complaint belongs to another municipal department." }, { status: 403 });
    }
    if (session.role === "worker" && complaint.assignedWorkerId !== session.userId) {
      return NextResponse.json({ error: "Access denied: you are not assigned to this work order." }, { status: 403 });
    }

    const parsedComplaint = {
      id: complaint.id,
      trackingId: complaint.trackingId,
      citizenId: complaint.citizenId,
      citizenName: complaint.citizen?.name || "Guest Citizen",
      category: complaint.category,
      summary: complaint.summary,
      description: complaint.description,
      language: complaint.language,
      inputMode: complaint.inputMode,
      lat: complaint.lat,
      lng: complaint.lng,
      address: complaint.address,
      beforePhotoUrls: JSON.parse(complaint.beforePhotoUrls || "[]"),
      urgency: complaint.urgency,
      reasons: JSON.parse(complaint.reasons || "[]"),
      flags: JSON.parse(complaint.flags || "[]"),
      confidence: complaint.confidence,
      departmentId: complaint.departmentId,
      departmentName: complaint.department?.name || "Unassigned",
      departmentCode: complaint.department?.code,
      status: complaint.status,
      assignedOfficerName: complaint.assignedOfficer?.name || null,
      assignedWorker: complaint.assignedWorker
        ? {
            id: complaint.assignedWorker.id,
            name: complaint.assignedWorker.name,
            role: complaint.assignedWorker.role,
          }
        : null,
      slaDueAt: complaint.slaDueAt,
      reopenCount: complaint.reopenCount,
      escalated: complaint.escalated,
      createdAt: complaint.createdAt,
      updatedAt: complaint.updatedAt,
      events: complaint.events.map((e) => ({
        id: e.id,
        type: e.type,
        actorRole: e.actorRole,
        actorName: e.actor?.name || "System",
        fromStatus: e.fromStatus,
        toStatus: e.toStatus,
        note: e.note,
        createdAt: e.createdAt,
      })),
      proofs: complaint.proofs.map((p) => ({
        id: p.id,
        workerName: p.worker?.name,
        afterPhotoUrl: p.afterPhotoUrl,
        note: p.note,
        materials: p.materials,
        lat: p.lat,
        lng: p.lng,
        createdAt: p.createdAt,
      })),
      feedbacks: complaint.feedbacks.map((f) => ({
        id: f.id,
        satisfied: f.satisfied,
        rating: f.rating,
        reason: f.reason,
        photoUrl: f.photoUrl,
        createdAt: f.createdAt,
      })),
    };

    return NextResponse.json({ complaint: parsedComplaint });
  } catch (error: any) {
    console.error("Get complaint error:", error);
    return NextResponse.json({ error: "Failed to fetch complaint." }, { status: 500 });
  }
}
