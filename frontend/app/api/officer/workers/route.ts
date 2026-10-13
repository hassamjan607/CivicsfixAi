import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || (session.role !== "officer" && session.role !== "admin")) {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const where: any = { role: "worker", active: true };
    if (session.role === "officer" && session.departmentId) {
      where.departmentId = session.departmentId;
    }

    const workers = await db.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        departmentId: true,
        active: true,
        assignedComplaints: {
          where: {
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
          },
          select: { id: true, urgency: true, status: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const parsedWorkers = workers.map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      phone: w.phone,
      role: "Field Worker",
      departmentId: w.departmentId,
      openJobCount: w.assignedComplaints.length,
      activeJobsCount: w.assignedComplaints.length,
      isAvailable: w.assignedComplaints.length < 5,
    }));

    return NextResponse.json({ workers: parsedWorkers });
  } catch (error: any) {
    console.error("Get workers error:", error);
    return NextResponse.json({ error: "Failed to fetch department workers." }, { status: 500 });
  }
}
