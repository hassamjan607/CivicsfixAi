import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, signSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth";
import { z } from "zod";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters."),
  language: z.enum(["en", "ur"]).default("en"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = registerSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.errors[0].message },
        { status: 400 }
      );
    }

    const { name, email, phone, password, language } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    // Check if phone already exists if provided
    if (phone?.trim()) {
      const existingPhone = await db.user.findFirst({
        where: { phone: phone.trim() },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: "An account with this phone number already exists." },
          { status: 409 }
        );
      }
    }

    const passwordHash = await hashPassword(password);

    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone?.trim() || null,
        passwordHash,
        role: "citizen",
        language,
        active: true,
      },
    });

    const sessionPayload = {
      userId: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: "citizen" as const,
      departmentId: null,
      language: user.language,
    };

    const token = signSessionToken(sessionPayload);
    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      roleHome: "/citizen",
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
    console.error("Register error:", error);
    return NextResponse.json(
      { error: "Failed to register account. Please try again." },
      { status: 500 }
    );
  }
}
