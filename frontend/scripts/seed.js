const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting CivicFix AI Database Seed...");

  // Clean existing data
  await prisma.emailLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.proof.deleteMany();
  await prisma.complaintEvent.deleteMany();
  await prisma.complaint.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  const defaultPassword = process.env.DEMO_USER_PASSWORD || "Password123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);

  // 1. Create Departments
  console.log("🏢 Seeding Departments...");
  const wasa = await prisma.department.create({
    data: {
      name: "Water & Sanitation Agency (WASA)",
      code: "WASA",
      categories: JSON.stringify(["Sewage", "Water Supply", "Drainage", "Biohazard"]),
      contactEmail: "wasa.control@civicfix.gov.pk",
      slaSettings: JSON.stringify({ emergencyHours: 2, highHours: 24, normalHours: 72 }),
    },
  });

  const tepa = await prisma.department.create({
    data: {
      name: "Traffic Engineering & Transport Planning Agency (TEPA)",
      code: "TEPA",
      categories: JSON.stringify(["Potholes", "Road Hazard", "Traffic Lights", "Streetlights"]),
      contactEmail: "tepa.control@civicfix.gov.pk",
      slaSettings: JSON.stringify({ emergencyHours: 4, highHours: 36, normalHours: 96 }),
    },
  });

  // 2. Create Users
  console.log("👥 Seeding Users...");

  // Admin
  const admin = await prisma.user.create({
    data: {
      name: "Ayesha Khan (Commissioner)",
      email: "admin@civicfix.gov.pk",
      phone: "0300-0000001",
      passwordHash,
      role: "admin",
      language: "en",
    },
  });

  // Officers
  const wasaOfficer = await prisma.user.create({
    data: {
      name: "Officer Tariq Mehmood",
      email: "officer.wasa@civicfix.gov.pk",
      phone: "0300-1112233",
      passwordHash,
      role: "officer",
      departmentId: wasa.id,
      language: "en",
    },
  });

  const tepaOfficer = await prisma.user.create({
    data: {
      name: "Officer Bilal Asghar",
      email: "officer.tepa@civicfix.gov.pk",
      phone: "0300-4445566",
      passwordHash,
      role: "officer",
      departmentId: tepa.id,
      language: "en",
    },
  });

  // Workers
  const wasaWorker1 = await prisma.user.create({
    data: {
      name: "Rashid Ali (Dewatering Lead)",
      email: "worker1.wasa@civicfix.gov.pk",
      phone: "0300-2223344",
      passwordHash,
      role: "worker",
      departmentId: wasa.id,
      officerId: wasaOfficer.id,
      language: "ur",
    },
  });

  const wasaWorker2 = await prisma.user.create({
    data: {
      name: "Farhan Qureshi (Pipe Tech)",
      email: "worker2.wasa@civicfix.gov.pk",
      phone: "0300-3334455",
      passwordHash,
      role: "worker",
      departmentId: wasa.id,
      officerId: wasaOfficer.id,
      language: "ur",
    },
  });

  const tepaWorker1 = await prisma.user.create({
    data: {
      name: "Sajid Mahmood (Asphalt Crew)",
      email: "worker1.tepa@civicfix.gov.pk",
      phone: "0300-5556677",
      passwordHash,
      role: "worker",
      departmentId: tepa.id,
      officerId: tepaOfficer.id,
      language: "ur",
    },
  });

  const tepaWorker2 = await prisma.user.create({
    data: {
      name: "Usman Ghani (Electrical Tech)",
      email: "worker2.tepa@civicfix.gov.pk",
      phone: "0300-6667788",
      passwordHash,
      role: "worker",
      departmentId: tepa.id,
      officerId: tepaOfficer.id,
      language: "en",
    },
  });

  // Citizens
  const citizen1 = await prisma.user.create({
    data: {
      name: "Hamza Malik",
      email: "citizen1@gmail.com",
      phone: "0301-9876543",
      passwordHash,
      role: "citizen",
      language: "en",
    },
  });

  const citizen2 = await prisma.user.create({
    data: {
      name: "Zainab Bibi",
      email: "citizen2@gmail.com",
      phone: "0302-8765432",
      passwordHash,
      role: "citizen",
      language: "ur",
    },
  });

  const citizen3 = await prisma.user.create({
    data: {
      name: "Muhammad Usman",
      email: "citizen3@gmail.com",
      phone: "0303-7654321",
      passwordHash,
      role: "citizen",
      language: "en",
    },
  });

  // 3. Seed ~30 Realistic Complaints
  console.log("📋 Seeding 30 Realistic Complaints across statuses...");

  const now = new Date();
  const past2d = new Date(now.getTime() - 48 * 3600 * 1000);
  const past1d = new Date(now.getTime() - 24 * 3600 * 1000);
  const future1d = new Date(now.getTime() + 24 * 3600 * 1000);
  const pastOverdue = new Date(now.getTime() - 6 * 3600 * 1000);

  // Key showcase complaints:
  // 1. CF-1042: RESOLVED, awaiting citizen confirmation with Before/After proof
  const c1042 = await prisma.complaint.create({
    data: {
      trackingId: "CF-1042",
      citizenId: citizen1.id,
      category: "Sewage",
      summary: "Severe sewage overflow on Street 4 blocking residential lane",
      description: "Hamari gali mein gutter ubal raha hai aur foul paani gharon ke samne jama ho gaya hai.",
      language: "ur",
      inputMode: "voice",
      lat: 31.5204,
      lng: 74.3587,
      address: "Street 4, Sector B, Near Care Clinic, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1541888946425-d0fbb18f156b?w=800&auto=format&fit=crop&q=80"]),
      urgency: 8,
      reasons: JSON.stringify([
        { points: "+4", title: "Base severity: Sewage overflow biohazard" },
        { points: "+2", title: "Sensitive location: Hospital clinic within 100m" },
        { points: "+1", title: "Weather bonus: Rain forecast in 12h" },
        { points: "+1", title: "Recurrence: Reported 2x this month" },
      ]),
      flags: JSON.stringify(["Hospital Zone", "Rain Alert"]),
      confidence: 0.94,
      departmentId: wasa.id,
      status: "RESOLVED",
      assignedOfficerId: wasaOfficer.id,
      assignedWorkerId: wasaWorker1.id,
      slaDueAt: future1d,
      reopenCount: 0,
      escalated: false,
      createdAt: past1d,
    },
  });

  await prisma.proof.create({
    data: {
      complaintId: c1042.id,
      workerId: wasaWorker1.id,
      afterPhotoUrl: "https://images.unsplash.com/photo-1590486803833-1c5dc8ddd4c8?w=800&auto=format&fit=crop&q=80",
      note: "Submersible suction pump deployed, manhole desilted, chlorinated spray applied.",
      materials: "Dewatering pump unit #4, 40kg Chlorine disinfectant powder",
      lat: 31.5205,
      lng: 74.3588,
      createdAt: now,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: c1042.id,
      actorId: wasaWorker1.id,
      actorRole: "worker",
      type: "RESOLVED",
      fromStatus: "IN_PROGRESS",
      toStatus: "RESOLVED",
      note: "Field repair completed, proof uploaded. Awaiting citizen confirmation.",
      createdAt: now,
    },
  });

  // 2. CF-1055: REOPENED
  const c1055 = await prisma.complaint.create({
    data: {
      trackingId: "CF-1055",
      citizenId: citizen2.id,
      category: "Sewage",
      summary: "Blocked manhole spillage recurring after rain",
      description: "Gutter dubara ubal raha hai, kal ki barish ke baad paani wapis nikal aaya hai.",
      language: "ur",
      inputMode: "voice",
      lat: 31.5497,
      lng: 74.3436,
      address: "Plot 18, Block G, Near Al-Razi Clinic, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80"]),
      urgency: 9,
      reasons: JSON.stringify([
        { points: "+5", title: "Emergency: Foul water penetrating residential threshold" },
        { points: "+2", title: "Hospital zone proximity" },
        { points: "+2", title: "Reopened by citizen: Incomplete previous fix" },
      ]),
      flags: JSON.stringify(["Reopened Ticket", "Biohazard"]),
      confidence: 0.91,
      departmentId: wasa.id,
      status: "REOPENED",
      assignedOfficerId: wasaOfficer.id,
      assignedWorkerId: wasaWorker2.id,
      slaDueAt: future1d,
      reopenCount: 1,
      escalated: true,
      createdAt: past2d,
    },
  });

  await prisma.feedback.create({
    data: {
      complaintId: c1055.id,
      citizenId: citizen2.id,
      satisfied: false,
      rating: 1,
      reason: "Water still overflowing after yesterday's rain. The underground main pipe is still clogged.",
      createdAt: past1d,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: c1055.id,
      actorId: citizen2.id,
      actorRole: "citizen",
      type: "REOPENED",
      fromStatus: "RESOLVED",
      toStatus: "REOPENED",
      note: "Citizen verified issue still unresolved: Water still overflowing.",
      createdAt: past1d,
    },
  });

  // 3. CF-1018: OVERDUE SLA (Escalated to Admin)
  const c1018 = await prisma.complaint.create({
    data: {
      trackingId: "CF-1018",
      citizenId: citizen3.id,
      category: "Water Supply",
      summary: "High pressure drinking water pipeline fracture on Main Boulevard",
      description: "Main road par drinking water line phatt gayi hai, hazaron gallon paani zaya ho raha hai.",
      language: "ur",
      inputMode: "text",
      lat: 31.5123,
      lng: 74.3412,
      address: "Main Boulevard Corner, Ward 12, Gulberg, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?w=800&auto=format&fit=crop&q=80"]),
      urgency: 10,
      reasons: JSON.stringify([
        { points: "+5", title: "Main distribution trunk rupture" },
        { points: "+3", title: "Critical infrastructure disruption" },
        { points: "+2", title: "Traffic thoroughfare flooding" },
      ]),
      flags: JSON.stringify(["Emergency", "High Water Loss", "OVERDUE"]),
      confidence: 0.98,
      departmentId: wasa.id,
      status: "ASSIGNED",
      assignedOfficerId: wasaOfficer.id,
      assignedWorkerId: wasaWorker1.id,
      slaDueAt: pastOverdue, // Overdue by 6 hours
      reopenCount: 0,
      escalated: true,
      createdAt: past2d,
    },
  });

  await prisma.complaintEvent.create({
    data: {
      complaintId: c1018.id,
      actorId: null,
      actorRole: "system",
      type: "ESCALATED",
      fromStatus: "ASSIGNED",
      toStatus: "ASSIGNED",
      note: "SLA deadline missed by 6 hours. Auto-escalated to City Administration.",
      createdAt: pastOverdue,
    },
  });

  // 4. CF-0899: CONFIRMED & CLOSED with 5-star rating
  const c0899 = await prisma.complaint.create({
    data: {
      trackingId: "CF-0899",
      citizenId: citizen1.id,
      category: "Streetlights",
      summary: "Broken fixture and flickering street light near primary school",
      description: "Street lamp 14 flickering and dark at night, kids walking safely is an issue.",
      language: "en",
      inputMode: "form",
      lat: 31.5312,
      lng: 74.3299,
      address: "Lane 9, Model Town C Block, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80"]),
      urgency: 6,
      reasons: JSON.stringify([
        { points: "+4", title: "Night public safety hazard" },
        { points: "+2", title: "School route proximity" },
      ]),
      flags: JSON.stringify(["School Zone"]),
      confidence: 0.95,
      departmentId: tepa.id,
      status: "CONFIRMED",
      assignedOfficerId: tepaOfficer.id,
      assignedWorkerId: tepaWorker2.id,
      slaDueAt: past1d,
      reopenCount: 0,
      escalated: false,
      createdAt: new Date(now.getTime() - 72 * 3600 * 1000),
    },
  });

  await prisma.feedback.create({
    data: {
      complaintId: c0899.id,
      citizenId: citizen1.id,
      satisfied: true,
      rating: 5,
      reason: "Super fast repair! LED fixture replaced within hours. Thank you!",
      createdAt: past1d,
    },
  });

  // 5. CF-1001: IN_PROGRESS (Roads - TEPA)
  await prisma.complaint.create({
    data: {
      trackingId: "CF-1001",
      citizenId: citizen2.id,
      category: "Potholes",
      summary: "Deep asphalt cavity near General Hospital entrance",
      description: "Large deep crater causing motorbike accidents on main entrance road.",
      language: "en",
      inputMode: "form",
      lat: 31.5054,
      lng: 74.3312,
      address: "Ferozepur Road near Care Hospital, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80"]),
      urgency: 8,
      reasons: JSON.stringify([
        { points: "+4", title: "Deep trench pothole" },
        { points: "+3", title: "Main artery emergency ambulance route" },
        { points: "+1", title: "Motorcycle slip hazard" },
      ]),
      flags: JSON.stringify(["Ambulance Route", "High Priority"]),
      confidence: 0.93,
      departmentId: tepa.id,
      status: "IN_PROGRESS",
      assignedOfficerId: tepaOfficer.id,
      assignedWorkerId: tepaWorker1.id,
      slaDueAt: future1d,
      reopenCount: 0,
      escalated: false,
      createdAt: past1d,
    },
  });

  // 6. CF-1060: SUBMITTED (New unassigned in WASA queue)
  await prisma.complaint.create({
    data: {
      trackingId: "CF-1060",
      citizenId: citizen3.id,
      category: "Drainage",
      summary: "Commercial market stormwater drain blocked by plastic waste",
      description: "Anarkali bazaar lane 2 drain overflowing with rain debris.",
      language: "ur",
      inputMode: "voice",
      lat: 31.5654,
      lng: 74.3123,
      address: "Anarkali Bazaar Lane 2, Lahore",
      beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=800&auto=format&fit=crop&q=80"]),
      urgency: 7,
      reasons: JSON.stringify([
        { points: "+4", title: "Commercial market stormwater blockage" },
        { points: "+2", title: "Impending rain forecast" },
        { points: "+1", title: "Pedestrian hazard" },
      ]),
      flags: JSON.stringify(["Commercial Area"]),
      confidence: 0.88,
      departmentId: wasa.id,
      status: "SUBMITTED",
      slaDueAt: future1d,
      reopenCount: 0,
      escalated: false,
      createdAt: now,
    },
  });

  // Generate 24 additional realistic complaints across categories and statuses
  const categoriesList = [
    { cat: "Sewage", dept: wasa.id, off: wasaOfficer.id, w1: wasaWorker1.id, w2: wasaWorker2.id },
    { cat: "Water Supply", dept: wasa.id, off: wasaOfficer.id, w1: wasaWorker1.id, w2: wasaWorker2.id },
    { cat: "Potholes", dept: tepa.id, off: tepaOfficer.id, w1: tepaWorker1.id, w2: tepaWorker2.id },
    { cat: "Streetlights", dept: tepa.id, off: tepaOfficer.id, w1: tepaWorker1.id, w2: tepaWorker2.id },
  ];

  const statuses = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CONFIRMED"];
  const streets = [
    "Mall Road near GPO", "Jail Road crossing", "Shadman Market Gate 3", "Gulberg III Main Market",
    "DHA Phase 5 Commercial", "Johar Town G1 Roundabout", "Faisal Town Block B", "Iqbal Town Moon Market",
    "Walled City Delhi Gate", "Bhati Gate Bazaar", "Samanabad Roundabout", "Chowk Yateem Khana"
  ];

  for (let i = 1; i <= 24; i++) {
    const idNum = 2000 + i;
    const catItem = categoriesList[i % categoriesList.length];
    const status = statuses[i % statuses.length];
    const street = streets[i % streets.length];
    const urgency = 3 + (i % 7); // 3 to 9
    const citizen = [citizen1, citizen2, citizen3][i % 3];
    const worker = i % 2 === 0 ? catItem.w1 : catItem.w2;

    await prisma.complaint.create({
      data: {
        trackingId: `CF-${idNum}`,
        citizenId: citizen.id,
        category: catItem.cat,
        summary: `${catItem.cat} reported at ${street}`,
        description: `Resident complaint logged regarding ${catItem.cat.toLowerCase()} in vicinity of ${street}. Requires municipal attention.`,
        language: i % 2 === 0 ? "en" : "ur",
        inputMode: i % 3 === 0 ? "voice" : i % 3 === 1 ? "text" : "form",
        lat: 31.48 + (i * 0.003),
        lng: 74.28 + (i * 0.003),
        address: `${street}, Lahore`,
        beforePhotoUrls: JSON.stringify(["https://images.unsplash.com/photo-1541888946425-d0fbb18f156b?w=800&auto=format&fit=crop&q=80"]),
        urgency,
        reasons: JSON.stringify([
          { points: `+${Math.floor(urgency / 2)}`, title: `Severity baseline: ${catItem.cat}` },
          { points: `+${urgency - Math.floor(urgency / 2)}`, title: `Spatial priority: ${street}` },
        ]),
        flags: JSON.stringify([urgency >= 7 ? "High Urgency" : "Standard Queue"]),
        confidence: 0.85 + (i % 15) * 0.01,
        departmentId: catItem.dept,
        status,
        assignedOfficerId: status !== "SUBMITTED" ? catItem.off : null,
        assignedWorkerId: (status === "IN_PROGRESS" || status === "RESOLVED" || status === "CONFIRMED") ? worker : null,
        slaDueAt: new Date(now.getTime() + (24 - (i % 48)) * 3600 * 1000),
        reopenCount: 0,
        escalated: false,
        createdAt: new Date(now.getTime() - i * 3 * 3600 * 1000),
      },
    });
  }

  // 4. Create sample notifications for each role
  console.log("🔔 Seeding In-App Notifications...");
  await prisma.notification.createMany({
    data: [
      {
        userId: citizen1.id,
        title: "Issue Fixed: CF-1042",
        body: "WASA crew completed dewatering on Street 4. Tap to confirm resolution.",
        link: "/citizen/complaints/CF-1042",
        createdAt: now,
      },
      {
        userId: wasaOfficer.id,
        title: "High Urgency Ticket: CF-1055",
        body: "Complaint reopened by citizen in Sector G. Immediate re-assignment needed.",
        link: "/officer/complaints/CF-1055",
        createdAt: past1d,
      },
      {
        userId: wasaWorker1.id,
        title: "New Job Assigned: CF-1042",
        body: "Dewatering pump assignment on Street 4. SLA deadline active.",
        link: "/worker/jobs/CF-1042",
        createdAt: past2d,
      },
      {
        userId: admin.id,
        title: "SLA Escalation Alert",
        body: "Water pipeline fracture CF-1018 on Main Boulevard has exceeded SLA.",
        link: "/admin/complaints",
        createdAt: pastOverdue,
      },
    ],
  });

  // 5. Seed initial EmailLog records
  console.log("📨 Seeding Email Logs...");
  await prisma.emailLog.createMany({
    data: [
      {
        to: "citizen1@gmail.com",
        subject: "We received your complaint CF-1042",
        template: "complaint_submitted_citizen",
        complaintId: c1042.id,
        status: "logged",
        sentAt: past1d,
      },
      {
        to: "wasa.control@civicfix.gov.pk",
        subject: "[URGENT 8/10] New sewage complaint, Street 4",
        template: "complaint_submitted_officer",
        complaintId: c1042.id,
        status: "logged",
        sentAt: past1d,
      },
      {
        to: "worker1.wasa@civicfix.gov.pk",
        subject: "New job assigned: CF-1042",
        template: "worker_assigned_worker",
        complaintId: c1042.id,
        status: "logged",
        sentAt: past1d,
      },
      {
        to: "citizen1@gmail.com",
        subject: "Your issue was marked as fixed. Please confirm (CF-1042)",
        template: "complaint_resolved_citizen",
        complaintId: c1042.id,
        status: "logged",
        sentAt: now,
      },
    ],
  });

  console.log("\n==========================================================================");
  console.log("✅ CivicFix AI Database Seed Complete!");
  console.log("==========================================================================");
  console.log("Demo Accounts (Password: Password123! for all):");
  console.log("  • Admin:         admin@civicfix.gov.pk");
  console.log("  • Officer WASA:  officer.wasa@civicfix.gov.pk");
  console.log("  • Officer TEPA:  officer.tepa@civicfix.gov.pk");
  console.log("  • Worker WASA:   worker1.wasa@civicfix.gov.pk");
  console.log("  • Worker TEPA:   worker1.tepa@civicfix.gov.pk");
  console.log("  • Citizen 1:     citizen1@gmail.com");
  console.log("  • Citizen 2:     citizen2@gmail.com");
  console.log("==========================================================================\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
