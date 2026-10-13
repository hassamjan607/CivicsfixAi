import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signSessionToken, SESSION_COOKIE_NAME, UserRole } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
    if (!isDemoMode && process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Demo login is disabled in production." }, { status: 403 });
    }

    const body = await req.json();
    const role: UserRole = body.role || "citizen";

    const emailMap: Record<UserRole, string> = {
      citizen: "citizen1@gmail.com",
      officer: "officer.wasa@civicfix.gov.pk",
      worker: "worker1.wasa@civicfix.gov.pk",
      admin: "admin@civicfix.gov.pk",
    };

    const targetEmail = emailMap[role] || "citizen1@gmail.com";
    const user = await db.user.findUnique({
      where: { email: targetEmail },
    });

    if (!user) {
      return NextResponse.json({ error: `Demo account for role ${role} not found. Please run seed.` }, { status: 404 });
    }

    const sessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role as UserRole,
      departmentId: user.departmentId,
      language: user.language,
    };

    const token = signSessionToken(sessionPayload);
    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      roleHome: `/${sessionPayload.role}`,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Demo login error:", error);
    return NextResponse.json({ error: "Failed to execute demo login." }, { status: 500 });
  }
}
