import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const { name, role, departmentId, active } = body;

    const user = await db.user.findUnique({ where: { id } });
    if (!user) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    // Safety check: block deactivating or demoting the last active administrator!
    if (user.role === "admin" && (active === false || (role && role !== "admin"))) {
      const activeAdminCount = await db.user.count({
        where: { role: "admin", active: true },
      });
      if (activeAdminCount <= 1) {
        return NextResponse.json(
          { error: "Cannot deactivate or change role of the last active administrator." },
          { status: 400 }
        );
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (departmentId !== undefined) updateData.departmentId = departmentId || null;
    if (active !== undefined) updateData.active = Boolean(active);

    const updated = await db.user.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error("Admin patch user error:", error);
    return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
  }
}
