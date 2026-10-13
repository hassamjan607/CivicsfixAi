import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    if (id === "all") {
      await db.notification.updateMany({
        where: { userId: session.userId, readAt: null },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ success: true });
    }

    await db.notification.updateMany({
      where: { id, userId: session.userId },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Mark read error:", error);
    return NextResponse.json({ error: "Failed to mark notification read" }, { status: 500 });
  }
}
