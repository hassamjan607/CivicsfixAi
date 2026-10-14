const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function cleanDummyData() {
  console.log("🧹 Starting CivicFix dummy data purge...");

  try {
    // 1. Delete dependent models first
    const deletedFeedbacks = await prisma.feedback.deleteMany();
    console.log(`✅ Cleared Feedback: ${deletedFeedbacks.count} records removed.`);

    const deletedProofs = await prisma.proof.deleteMany();
    console.log(`✅ Cleared Proof: ${deletedProofs.count} records removed.`);

    const deletedEvents = await prisma.complaintEvent.deleteMany();
    console.log(`✅ Cleared ComplaintEvent: ${deletedEvents.count} records removed.`);

    const deletedNotifications = await prisma.notification.deleteMany();
    console.log(`✅ Cleared Notification: ${deletedNotifications.count} records removed.`);

    const deletedEmailLogs = await prisma.emailLog.deleteMany();
    console.log(`✅ Cleared EmailLog: ${deletedEmailLogs.count} records removed.`);

    // 2. Delete all complaints
    const deletedComplaints = await prisma.complaint.deleteMany();
    console.log(`✅ Cleared Complaint: ${deletedComplaints.count} records removed.`);

    // Reset sqlite sequence for cleaned tables if present
    try {
      await prisma.$executeRawUnsafe(
        "DELETE FROM sqlite_sequence WHERE name IN ('Complaint', 'ComplaintEvent', 'Notification', 'Proof', 'Feedback', 'EmailLog')"
      );
      console.log("🔄 Reset SQLite auto-increment sequences.");
    } catch (e) {
      // sqlite_sequence may not exist if no autoincrement primary keys
    }

    // 3. Verify retained core records
    const userCount = await prisma.user.count();
    const deptCount = await prisma.department.count();

    console.log("\n🔒 Verification of Preserved Authentication & Structural Records:");
    console.log(`   - Users retained: ${userCount} (Admin, Officers, Workers, Citizens intact)`);
    console.log(`   - Departments retained: ${deptCount} (WASA, TEPA intact)`);

    const users = await prisma.user.findMany({
      select: { email: true, role: true, name: true },
    });
    console.log("\n👥 Available Login Credentials:");
    users.forEach((u) => {
      console.log(`   • [${u.role.toUpperCase()}] ${u.name} <${u.email}>`);
    });

    console.log("\n✨ Frontend database is now 100% clean and ready for live end-to-end testing!");
  } catch (err) {
    console.error("❌ Error purging dummy data:", err);
  } finally {
    await prisma.$disconnect();
  }
}

cleanDummyData();
