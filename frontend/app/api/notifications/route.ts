import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getServerSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const notifications = await db.notification.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = notifications.filter((n) => !n.readAt).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error("Notifications error:", error);
    return NextResponse.json({ notifications: [], unreadCount: 0 }, { status: 500 });
  }
}
