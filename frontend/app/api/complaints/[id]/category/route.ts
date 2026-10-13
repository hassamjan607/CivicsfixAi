import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "officer" && session.role !== "admin")) {
      return NextResponse.json({ error: "Only officers can modify complaint categories." }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { category, note } = body;

    if (!category) {
      return NextResponse.json({ error: "Category is required." }, { status: 400 });
    }

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    if (session.role === "officer" && complaint.departmentId !== session.departmentId) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const oldCategory = complaint.category;
    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: { category },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session.userId,
        actorRole: session.role,
        type: "CATEGORY_CHANGED",
        fromStatus: complaint.status,
        toStatus: complaint.status,
        note: `Category adjusted from ${oldCategory} to ${category}. ${note || ""}`,
      },
    });

    return NextResponse.json({ success: true, complaint: updated });
  } catch (error: any) {
    console.error("Update category error:", error);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}
