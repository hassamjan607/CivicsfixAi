import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const events = await db.complaintEvent.findMany({
      include: {
        actor: { select: { id: true, name: true, role: true, email: true } },
        complaint: { select: { id: true, trackingId: true, category: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const parsed = events.map((e: any) => ({
      id: e.id,
      trackingId: e.complaint?.trackingId || "N/A",
      complaintCategory: e.complaint?.category || "N/A",
      actorName: e.actor?.name || "System Automated Rule",
      actorRole: e.actorRole,
      type: e.type,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt,
    }));

    return NextResponse.json({ auditEvents: parsed });
  } catch (error: any) {
    console.error("Get audit events error:", error);
    return NextResponse.json({ error: "Failed to fetch audit log." }, { status: 500 });
  }
}
