import { NextRequest, NextResponse } from "next/server";
import { verifySignedToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { sendEmailAsync } from "@/lib/email";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const appUrl = process.env.APP_URL || "http://localhost:3000";

  if (!token) {
    return NextResponse.redirect(`${appUrl}/track?error=missing_token`);
  }

  const payload = verifySignedToken(token);
  if (!payload) {
    return NextResponse.redirect(`${appUrl}/track?error=invalid_or_expired_token`);
  }

  const { complaintId, action } = payload;

  const complaint = await db.complaint.findUnique({
    where: { trackingId: complaintId },
    include: { department: true, citizen: true },
  });

  if (!complaint) {
    return NextResponse.redirect(`${appUrl}/track?error=complaint_not_found`);
  }

  if (action === "confirm") {
    // Only allow confirming if complaint is currently RESOLVED or SUBMITTED
    await db.complaint.update({
      where: { id: complaint.id },
      data: { status: "CONFIRMED" },
    });

    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: complaint.citizenId || null,
        actorRole: "citizen",
        type: "CONFIRMED",
        fromStatus: complaint.status,
        toStatus: "CONFIRMED",
        note: "Citizen confirmed resolution via secure email verification link.",
      },
    });

    // Send thank you email
    if (complaint.citizen?.email || complaint.guestContact) {
      sendEmailAsync({
        to: complaint.citizen?.email || complaint.guestContact!,
        subject: `Thank you! Complaint Confirmed Closed: ${complaint.trackingId}`,
        template: "complaint_confirmed_citizen",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          language: (complaint.language as "en" | "ur") || "en",
        },
      });
    }

    return NextResponse.redirect(`${appUrl}/track/${complaint.trackingId}?verified=confirmed`);
  } else if (action === "reopen") {
    await db.complaint.update({
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
        actorId: complaint.citizenId || null,
        actorRole: "citizen",
        type: "REOPENED",
        fromStatus: complaint.status,
        toStatus: "REOPENED",
        note: "Citizen marked issue as still unresolved via secure email verification link.",
      },
    });

    // Alert officer & admin
    if (complaint.department?.contactEmail) {
      sendEmailAsync({
        to: complaint.department.contactEmail,
        subject: `[REOPENED] Issue Reported Not Fixed: ${complaint.trackingId}`,
        template: "complaint_reopened",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          reopenReason: "Citizen marked issue not fixed via email link",
          language: "en",
        },
      });
    }

    return NextResponse.redirect(`${appUrl}/track/${complaint.trackingId}?verified=reopened`);
  }

  return NextResponse.redirect(`${appUrl}/track/${complaint.trackingId}`);
}
