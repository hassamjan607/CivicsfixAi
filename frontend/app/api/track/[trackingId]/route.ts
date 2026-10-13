import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { trackingId: string } }) {
  try {
    const { trackingId } = params;

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [
          { trackingId: trackingId.toUpperCase() },
          { trackingId: trackingId },
          { id: trackingId },
        ],
      },
      include: {
        department: { select: { name: true, code: true } },
        assignedWorker: { select: { name: true, role: true } },
        proofs: { select: { afterPhotoUrl: true, note: true, createdAt: true } },
        events: {
          select: { type: true, actorRole: true, note: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint tracking ID not found." }, { status: 404 });
    }

    return NextResponse.json({
      complaint: {
        trackingId: complaint.trackingId,
        category: complaint.category,
        summary: complaint.summary,
        description: complaint.description,
        address: complaint.address,
        status: complaint.status,
        urgency: complaint.urgency,
        reasons: JSON.parse(complaint.reasons || "[]"),
        departmentName: complaint.department?.name || "Municipal Agency",
        assignedWorkerFirstName: complaint.assignedWorker ? complaint.assignedWorker.name.split(" ")[0] : null,
        slaDueAt: complaint.slaDueAt,
        createdAt: complaint.createdAt,
        beforePhotoUrls: JSON.parse(complaint.beforePhotoUrls || "[]"),
        proofs: complaint.proofs,
        events: complaint.events,
      },
    });
  } catch (error: any) {
    console.error("Public track error:", error);
    return NextResponse.json({ error: "Failed to query tracking information." }, { status: 500 });
  }
}
