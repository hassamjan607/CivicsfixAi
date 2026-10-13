import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession, hashPassword } from "@/lib/auth";
import { z } from "zod";

const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6),
  role: z.enum(["officer", "worker", "admin", "citizen"]),
  departmentId: z.string().optional(),
});

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const users = await db.user.findMany({
      include: {
        department: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const parsed = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      active: u.active,
      language: u.language,
      departmentId: u.departmentId,
      departmentName: u.department?.name || "None",
      createdAt: u.createdAt,
    }));

    return NextResponse.json({ users: parsed });
  } catch (error: any) {
    console.error("Admin get users error:", error);
    return NextResponse.json({ error: "Failed to fetch users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const body = await req.json();
    const result = createUserSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });
    }

    const { name, email, phone, password, role, departmentId } = result.data;
    const normalizedEmail = email.trim().toLowerCase();

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists." }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    const user = await db.user.create({
      data: {
        name,
        email: normalizedEmail,
        phone: phone || null,
        passwordHash,
        role,
        departmentId: departmentId || null,
        active: true,
      },
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error("Admin create user error:", error);
    return NextResponse.json({ error: "Failed to create user." }, { status: 500 });
  }
}
