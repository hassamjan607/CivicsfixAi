import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { sendEmail, getEmailConfigStatus, EmailTemplate } from "@/lib/email";

/**
 * GET /api/admin/emails/test
 * Returns current email configuration status without sending an email.
 */
export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin privileges required." }, { status: 403 });
    }

    const config = getEmailConfigStatus();
    return NextResponse.json({
      status: "ok",
      config,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to retrieve email config." }, { status: 500 });
  }
}

/**
 * POST /api/admin/emails/test
 * Dispatches a test municipal notification email to the specified recipient.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin privileges required." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const to = body.to || session.email;
    const template: EmailTemplate = body.template || "complaint_submitted_citizen";
    const language: "en" | "ur" = body.language === "ur" ? "ur" : "en";

    const config = getEmailConfigStatus();

    const result = await sendEmail({
      to,
      subject: `[Test] CivicFix AI Municipal Email Test (${config.provider.toUpperCase()})`,
      template,
      data: {
        trackingId: "CF-TEST-9999",
        category: "Damaged Road / Pothole",
        summary: "Hazardous crater near Main Boulevard intersection requires emergency resurfacing.",
        urgency: 9,
        reasons: [
          { points: "+4.0", title: "Heavy traffic municipal artery hazard" },
          { points: "+2.5", title: "Proximity to Central High School" },
          { points: "+2.5", title: "Heavy monsoon rain forecasted within 24h" },
        ],
        departmentName: "Roads & Highway Infrastructure",
        address: "Plot 42, Main Boulevard, Sector G-9",
        slaDeadline: "Within 12 Hours (Emergency SLA)",
        workerName: "Tariq Mehmood (Field Squad 4)",
        language,
      },
    });

    return NextResponse.json({
      success: result.success,
      id: result.id,
      error: result.error,
      provider: config.provider,
      recipient: to,
      template,
    });
  } catch (error: any) {
    console.error("Test email dispatch error:", error);
    return NextResponse.json({ error: error?.message || "Failed to dispatch test email." }, { status: 500 });
  }
}
