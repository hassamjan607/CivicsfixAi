import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { sendEmailAsync } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { rating, comment } = body;

    const complaint = await db.complaint.findFirst({
      where: {
        OR: [{ id }, { trackingId: id }, { trackingId: id.toUpperCase() }],
      },
      include: { citizen: true },
    });

    if (!complaint) {
      return NextResponse.json({ error: "Complaint not found." }, { status: 404 });
    }

    // Only citizen owner or admin can confirm
    if (session && session.role === "citizen" && complaint.citizenId !== session.userId) {
      return NextResponse.json({ error: "You can only confirm your own complaints." }, { status: 403 });
    }

    const previousStatus = complaint.status;

    // Create Feedback record
    await db.feedback.create({
      data: {
        complaintId: complaint.id,
        citizenId: session?.userId || complaint.citizenId || null,
        satisfied: true,
        rating: rating ? Number(rating) : 5,
        reason: comment || "Citizen verified issue resolved satisfactorily.",
      },
    });

    const updated = await db.complaint.update({
      where: { id: complaint.id },
      data: { status: "CONFIRMED" },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session?.userId || complaint.citizenId || null,
        actorRole: session?.role || "citizen",
        type: "CONFIRMED",
        fromStatus: previousStatus,
        toStatus: "CONFIRMED",
        note: `Citizen confirmed resolution. Rating: ${rating || 5}/5. Feedback: "${comment || "Satisfied"}"`,
      },
    });

    // Thank you email
    const citizenEmail = complaint.citizen?.email || (complaint.guestContact?.includes("@") ? complaint.guestContact : null);
    if (citizenEmail) {
      sendEmailAsync({
        to: citizenEmail,
        subject: `Thank you! Complaint Confirmed Closed: ${complaint.trackingId}`,
        template: "complaint_confirmed_citizen",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          language: (complaint.language as "en" | "ur") || "en",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Complaint confirmed and closed. Thank you for your feedback!",
      complaint: updated,
    });
  } catch (error: any) {
    console.error("Confirm complaint error:", error);
    return NextResponse.json({ error: "Failed to confirm resolution." }, { status: 500 });
  }
}
