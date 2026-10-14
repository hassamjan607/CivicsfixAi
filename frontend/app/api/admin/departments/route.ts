import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Access denied." }, { status: 401 });
    }

    const departments = await db.department.findMany({
      include: {
        _count: { select: { complaints: true, users: true } },
      },
      orderBy: { name: "asc" },
    });

    const parsed = departments.map((d: any) => ({
      id: d.id,
      name: d.name,
      code: d.code,
      categories: JSON.parse(d.categories || "[]"),
      contactEmail: d.contactEmail,
      slaSettings: JSON.parse(d.slaSettings || "{}"),
      complaintsCount: d._count.complaints,
      staffCount: d._count.users,
    }));

    return NextResponse.json({ departments: parsed });
  } catch (error: any) {
    console.error("Get departments error:", error);
    return NextResponse.json({ error: "Failed to fetch departments." }, { status: 500 });
  }
}
