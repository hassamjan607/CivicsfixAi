import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied." }, { status: 403 });
    }

    const emails = await db.emailLog.findMany({
      orderBy: { sentAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ emails });
  } catch (error: any) {
    console.error("Get email logs error:", error);
    return NextResponse.json({ error: "Failed to fetch email outbox log." }, { status: 500 });
  }
}
