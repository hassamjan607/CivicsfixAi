import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Administrator privileges required." }, { status: 403 });
    }

    const totalComplaints = await db.complaint.count();
    const resolvedComplaints = await db.complaint.count({
      where: { status: { in: ["RESOLVED", "CONFIRMED"] } },
    });
    const pendingComplaints = await db.complaint.count({
      where: { status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"] } },
    });
    const escalatedComplaints = await db.complaint.count({
      where: { escalated: true },
    });

    const now = new Date();
    const overdueComplaints = await db.complaint.count({
      where: {
        slaDueAt: { lt: now },
        status: { in: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "REOPENED"] },
      },
    });

    const reopenRate = totalComplaints > 0
      ? ((await db.complaint.count({ where: { reopenCount: { gt: 0 } } })) / totalComplaints) * 100
      : 0;

    const complaintsByCategory = await db.complaint.groupBy({
      by: ["category"],
      _count: { id: true },
    });

    const complaintsByDepartment = await db.department.findMany({
      include: {
        _count: { select: { complaints: true, users: true } },
      },
    });

    const totalUsers = await db.user.count();
    const reopenedComplaints = await db.complaint.count({ where: { status: "REOPENED" } });

    return NextResponse.json({
      stats: {
        total: totalComplaints,
        totalComplaints: totalComplaints,
        resolved: resolvedComplaints,
        resolvedComplaints: resolvedComplaints,
        pending: pendingComplaints,
        pendingComplaints: pendingComplaints,
        escalated: escalatedComplaints,
        overdue: overdueComplaints,
        overdueComplaints: overdueComplaints,
        reopenedComplaints: reopenedComplaints,
        departmentsCount: complaintsByDepartment.length,
        usersCount: totalUsers,
        slaComplianceRate: totalComplaints > 0 ? Math.round(((totalComplaints - overdueComplaints) / totalComplaints) * 100) : 100,
        reopenRate: Math.round(reopenRate * 10) / 10,
        byCategory: complaintsByCategory.map((c: any) => ({ category: c.category, count: c._count.id })),
        byDepartment: complaintsByDepartment.map((d: any) => ({
          name: d.name,
          code: d.code,
          complaintsCount: d._count.complaints,
          staffCount: d._count.users,
        })),
      },
    });
  } catch (error: any) {
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Failed to calculate city statistics." }, { status: 500 });
  }
}
