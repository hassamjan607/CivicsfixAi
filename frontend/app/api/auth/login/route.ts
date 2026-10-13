import { NextRequest, NextResponse } from "next/server";
import { authenticateUser, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { identifier, password } = body;

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email or phone number and password are required." },
        { status: 400 }
      );
    }

    const session = await authenticateUser(identifier, password);
    if (!session) {
      return NextResponse.json(
        { error: "Invalid email/phone or password." },
        { status: 401 }
      );
    }

    const token = signSessionToken(session);
    const response = NextResponse.json({
      success: true,
      user: session,
      roleHome: `/${session.role}`,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "Internal server error occurred during login." },
      { status: 500 }
    );
  }
}
