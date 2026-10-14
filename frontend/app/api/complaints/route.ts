import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";
import { runTriage } from "@/lib/triage";
import { sendEmail, sendEmailAsync } from "@/lib/email";
import { sendSms } from "@/lib/sms";
import { z } from "zod";

const createComplaintSchema = z.object({
  description: z.string().min(5, "Please provide a detailed description of the issue."),
  summary: z.string().optional(),
  category: z.string().optional(),
  inputMode: z.enum(["voice", "text", "form"]).default("voice"),
  language: z.enum(["en", "ur"]).default("en"),
  lat: z.number().optional(),
  lng: z.number().optional(),
  address: z.string().optional(),
  beforePhotoUrls: z.array(z.string()).default([]),
  guestContact: z.string().optional(),
});

function generateTrackingId(): string {
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CF-${randomDigits}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    const body = await req.json();
    const parsed = createComplaintSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const data = parsed.data;

    // Generate unique tracking ID
    let trackingId = generateTrackingId();
    let collisionCheck = await db.complaint.findUnique({ where: { trackingId } });
    while (collisionCheck) {
      trackingId = generateTrackingId();
      collisionCheck = await db.complaint.findUnique({ where: { trackingId } });
    }

    // Run AI Triage Engine
    const triage = await runTriage({
      text: data.description,
      categoryHint: data.category,
      lat: data.lat,
      lng: data.lng,
      hasPhoto: data.beforePhotoUrls.length > 0,
    });

    const citizenId = session?.role === "citizen" ? session.userId : null;
    const citizenEmail = session?.email || (data.guestContact?.includes("@") ? data.guestContact : null);
    const citizenPhone = session?.phone || (!data.guestContact?.includes("@") ? data.guestContact : null);

    const complaint = await db.complaint.create({
      data: {
        trackingId,
        citizenId,
        guestContact: data.guestContact || citizenPhone || null,
        category: triage.category,
        summary: data.summary || triage.summary,
        description: data.description,
        language: data.language,
        inputMode: data.inputMode,
        lat: data.lat || null,
        lng: data.lng || null,
        address: data.address || "Street location verified via GPS",
        beforePhotoUrls: JSON.stringify(data.beforePhotoUrls),
        urgency: triage.urgency,
        reasons: JSON.stringify(triage.reasons),
        flags: JSON.stringify(triage.flags),
        confidence: triage.confidence,
        departmentId: triage.departmentId,
        status: "SUBMITTED",
        slaDueAt: triage.slaDueAt,
        reopenCount: 0,
        escalated: triage.urgency === 10,
      },
      include: {
        department: true,
      },
    });

    // Write initial audit event
    await db.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        actorId: session?.userId || null,
        actorRole: session?.role || "citizen",
        type: "CREATED",
        fromStatus: null,
        toStatus: "SUBMITTED",
        note: `Complaint logged via ${data.inputMode} intake. Scored urgency ${triage.urgency}/10. Routed to ${triage.departmentName}.`,
      },
    });

    // 1. Notification & Email to Citizen
    if (citizenEmail) {
      sendEmailAsync({
        to: citizenEmail,
        subject: `We received your complaint ${complaint.trackingId}`,
        template: "complaint_submitted_citizen",
        complaintId: complaint.id,
        data: {
          trackingId: complaint.trackingId,
          category: complaint.category,
          departmentName: triage.departmentName,
          slaDeadline: complaint.slaDueAt ? new Date(complaint.slaDueAt).toLocaleString() : "Within 24 Hours",
          language: data.language,
        },
      });
    }

    // 2. Alert to Department Officers
    const officers = await db.user.findMany({
      where: {
        OR: [
          { departmentId: triage.departmentId },
          { email: "hassamjan607@gmail.com" },
        ],
        role: "officer",
        active: true,
      },
    });

    const isUrgent = triage.urgency >= 7;
    const officerSubjectPrefix = triage.urgency === 10 ? "[EMERGENCY]" : isUrgent ? `[URGENT ${triage.urgency}/10]` : "[New Complaint]";
    const officerSubject = `${officerSubjectPrefix} New ${complaint.category} complaint, ${complaint.address || "Zone"}`;

    for (const officer of officers) {
      if (officer.email) {
        await sendEmail({
          to: officer.email,
          subject: officerSubject,
          template: "complaint_submitted_officer",
          complaintId: complaint.id,
          data: {
            trackingId: complaint.trackingId,
            category: complaint.category,
            summary: complaint.summary,
            urgency: complaint.urgency,
            reasons: triage.reasons,
            address: complaint.address || "Map location",
            slaDeadline: complaint.slaDueAt ? new Date(complaint.slaDueAt).toLocaleString() : "Active SLA",
            language: (officer.language as "en" | "ur") || "en",
          },
        });
      }

      // In-app notification to officer
      await db.notification.create({
        data: {
          userId: officer.id,
          title: `${officerSubjectPrefix} New Ticket: ${complaint.trackingId}`,
          body: `${complaint.category}: ${complaint.summary}`,
          link: `/officer/complaints/${complaint.trackingId}`,
        },
      });
    }

    // 3. Emergency SMS stub if urgency === 10
    if (triage.urgency === 10) {
      sendSms({
        to: "WASA-EMERGENCY-DISPATCH",
        body: `CRITICAL 10/10 EMERGENCY: Complaint ${complaint.trackingId} logged at ${complaint.address}. ${complaint.summary}`,
        complaintTrackingId: complaint.trackingId,
      });
    }

    return NextResponse.json({
      success: true,
      complaint: {
        id: complaint.id,
        trackingId: complaint.trackingId,
        category: complaint.category,
        summary: complaint.summary,
        description: complaint.description,
        urgency: complaint.urgency,
        reasons: triage.reasons,
        departmentName: triage.departmentName,
        status: complaint.status,
        slaDueAt: complaint.slaDueAt,
        address: complaint.address,
      },
    });
  } catch (error: any) {
    console.error("Create complaint error:", error);
    return NextResponse.json({ error: error?.message || "Failed to submit complaint." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Authentication required to access complaints list." }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const search = searchParams.get("search");

    const where: any = {};

    // 1. Role-based scoping (Enforced strictly on server)
    if (session.role === "citizen") {
      where.citizenId = session.userId;
    } else if (session.role === "officer") {
      if (!session.departmentId) {
        return NextResponse.json({ error: "Officer has no assigned department." }, { status: 400 });
      }
      where.departmentId = session.departmentId;
    } else if (session.role === "worker") {
      where.assignedWorkerId = session.userId;
    } else if (session.role === "admin") {
      // Admin sees everything
    }

    // 2. Query Filters
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (category && category !== "ALL") {
      where.category = category;
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { trackingId: { contains: q } },
        { summary: { contains: q } },
        { address: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const complaints = await db.complaint.findMany({
      where,
      include: {
        department: true,
        citizen: { select: { id: true, name: true, email: true } },
        assignedWorker: { select: { id: true, name: true, role: true } },
      },
      orderBy: [
        { urgency: "desc" },
        { slaDueAt: "asc" },
      ],
      take: 100,
    });

    const parsedComplaints = complaints.map((c) => ({
      id: c.id,
      trackingId: c.trackingId,
      category: c.category,
      summary: c.summary,
      description: c.description,
      urgency: c.urgency,
      reasons: JSON.parse(c.reasons || "[]"),
      flags: JSON.parse(c.flags || "[]"),
      status: c.status,
      confidence: c.confidence,
      address: c.address,
      lat: c.lat,
      lng: c.lng,
      beforePhotoUrls: JSON.parse(c.beforePhotoUrls || "[]"),
      departmentName: c.department?.name || "Unassigned",
      departmentCode: c.department?.code,
      assignedWorkerName: c.assignedWorker?.name || null,
      slaDueAt: c.slaDueAt,
      escalated: c.escalated,
      reopenCount: c.reopenCount,
      createdAt: c.createdAt,
    }));

    return NextResponse.json({ complaints: parsedComplaints });
  } catch (error: any) {
    console.error("Fetch complaints error:", error);
    return NextResponse.json({ error: "Failed to retrieve complaints." }, { status: 500 });
  }
}
