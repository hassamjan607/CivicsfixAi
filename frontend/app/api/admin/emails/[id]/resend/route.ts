import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { sendEmail, EmailTemplate } from "@/lib/email";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { id } = params;
    const log = await db.emailLog.findUnique({ where: { id } });
    if (!log) {
      return NextResponse.json({ error: "Email log not found." }, { status: 404 });
    }

    const complaint = log.complaintId
      ? await db.complaint.findUnique({ where: { id: log.complaintId } })
      : null;

    const resendResult = await sendEmail({
      to: log.to,
      subject: log.subject,
      template: log.template as EmailTemplate,
      complaintId: log.complaintId || undefined,
      data: {
        trackingId: complaint?.trackingId || "CF-1042",
        category: complaint?.category || "Municipal Issue",
        address: complaint?.address || "Site address",
        language: (complaint?.language as "en" | "ur") || "en",
      },
    });

    await db.emailLog.update({
      where: { id: log.id },
      data: {
        attempts: log.attempts + 1,
        status: resendResult.success ? "sent" : "failed",
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: "Email resent successfully." });
  } catch (error: any) {
    console.error("Resend email error:", error);
    return NextResponse.json({ error: "Failed to resend email." }, { status: 500 });
  }
}
