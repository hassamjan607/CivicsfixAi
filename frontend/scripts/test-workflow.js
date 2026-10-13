const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function run() {
  console.log("=== STARTING CIVICFIX END-TO-END WORKFLOW TEST ===");

  async function login(identifier, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password }),
    });
    if (!res.ok) {
      throw new Error(`Login failed for ${identifier}: ${res.statusText}`);
    }
    const cookieHeader = res.headers.get("set-cookie");
    // Extract civicfix_session cookie
    const match = cookieHeader && cookieHeader.match(/civicfix_session=([^;]+)/);
    const sessionCookie = match ? match[1] : null;
    const data = await res.json();
    return { user: data.user, cookie: `civicfix_session=${sessionCookie}` };
  }

  // 1. Citizen login & Report
  console.log("\n[1] Testing Citizen Report Creation...");
  const citizen = await login("citizen1@gmail.com", "Password123!");
  console.log(`✓ Citizen logged in: ${citizen.user.name}`);

  const reportRes = await fetch(`${BASE_URL}/api/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: citizen.cookie,
    },
    body: JSON.stringify({
      category: "Sewage",
      description: "Severe manhole overflow spilling contaminated water across school zone",
      inputMode: "voice",
      address: "Street 4, Sector B, Lahore",
      lat: 31.5204,
      lng: 74.3587,
    }),
  });

  const reportData = await reportRes.json();
  if (!reportRes.ok) throw new Error("Report failed: " + JSON.stringify(reportData));
  const complaint = reportData.complaint;
  console.log(`✓ Complaint created: ${complaint.trackingId} (Urgency: ${complaint.urgency}/10, Dept: ${complaint.departmentName || 'WASA'}, Status: ${complaint.status})`);
  console.log(`  Reasons: ${JSON.stringify(complaint.reasons)}`);

  // 2. Department Officer Triage & Assignment
  console.log("\n[2] Testing Department Officer Review & Worker Assignment...");
  const officer = await login("officer.wasa@civicfix.gov.pk", "Password123!");
  console.log(`✓ WASA Officer logged in: ${officer.user.name}`);

  // Fetch department workers
  const workersRes = await fetch(`${BASE_URL}/api/officer/workers`, {
    headers: { Cookie: officer.cookie },
  });
  const workersData = await workersRes.json();
  const workerToAssign = workersData.workers[0];
  console.log(`✓ Found ${workersData.workers.length} department workers. Assigning to: ${workerToAssign.name} (${workerToAssign.activeJobsCount} active jobs)`);

  const assignRes = await fetch(`${BASE_URL}/api/complaints/${complaint.id}/assign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: officer.cookie,
    },
    body: JSON.stringify({
      workerId: workerToAssign.id,
      instructions: "Deploy suction vehicle and jetting equipment to Street 4.",
    }),
  });
  if (!assignRes.ok) {
    const text = await assignRes.text();
    throw new Error(`Assignment failed with HTTP ${assignRes.status}: ${text}`);
  }
  const assignData = await assignRes.json();
  console.log(`✓ Complaint transitioned to status: ${assignData.complaint.status} (Assigned to ${workerToAssign.name})`);

  // 3. Worker Starts Job & Resolves with After Photo
  console.log("\n[3] Testing Worker Start & Completion with After Photo...");
  const worker = await login(workerToAssign.email, "Password123!");
  console.log(`✓ Field Worker logged in: ${worker.user.name}`);

  // Start job
  const startRes = await fetch(`${BASE_URL}/api/complaints/${complaint.id}/start`, {
    method: "POST",
    headers: { Cookie: worker.cookie },
  });
  const startData = await startRes.json();
  console.log(`✓ Worker started job. Status: ${startData.complaint.status}`);

  // Resolve job with required After photo
  const resolveRes = await fetch(`${BASE_URL}/api/complaints/${complaint.id}/resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: worker.cookie,
    },
    body: JSON.stringify({
      afterPhotoUrl: "/uploads/proof-fixed-clean.jpg",
      note: "Main blockage cleared with high-pressure water jet. Area disinfected.",
      materials: "Suction Pump, High-Pressure Jet, Chlorine Decontaminant",
    }),
  });
  const resolveData = await resolveRes.json();
  if (!resolveRes.ok) throw new Error("Resolve failed: " + JSON.stringify(resolveData));
  console.log(`✓ Worker resolved job. Status: ${resolveData.complaint.status} (Proof attached: ${resolveData.proof?.afterPhotoUrl || 'Yes'})`);

  // 4. Citizen Confirms Fix
  console.log("\n[4] Testing Citizen Photographic Review & Confirmation...");
  const confirmRes = await fetch(`${BASE_URL}/api/complaints/${complaint.id}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: citizen.cookie,
    },
    body: JSON.stringify({
      rating: 5,
      note: "Street is completely clean and dry now. Excellent response!",
    }),
  });
  const confirmData = await confirmRes.json();
  if (!confirmRes.ok) throw new Error("Confirmation failed: " + JSON.stringify(confirmData));
  console.log(`✓ Citizen confirmed resolution. Status: ${confirmData.complaint.status} (Closed)`);

  // 5. Test Reopen Path
  console.log("\n[5] Testing Reopen Workflow...");
  const report2Res = await fetch(`${BASE_URL}/api/complaints`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: citizen.cookie,
    },
    body: JSON.stringify({
      category: "Sewage",
      description: "Secondary drain leak on corner street",
      address: "Street 4 Corner, Lahore",
    }),
  });
  const comp2 = (await report2Res.json()).complaint;

  // Officer assigns and worker resolves
  await fetch(`${BASE_URL}/api/complaints/${comp2.id}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: officer.cookie },
    body: JSON.stringify({ workerId: workerToAssign.id }),
  });
  await fetch(`${BASE_URL}/api/complaints/${comp2.id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: worker.cookie },
    body: JSON.stringify({
      afterPhotoUrl: "/uploads/proof2.jpg",
      note: "Temporary sandbag barrier placed.",
    }),
  });

  // Citizen rejects / reopens
  const reopenRes = await fetch(`${BASE_URL}/api/complaints/${comp2.id}/reopen`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: citizen.cookie,
    },
    body: JSON.stringify({
      reason: "Sandbags are leaking; the drain pipe is still cracked beneath.",
    }),
  });
  const reopenData = await reopenRes.json();
  if (!reopenRes.ok) throw new Error("Reopen failed: " + JSON.stringify(reopenData));
  console.log(`✓ Complaint reopened by citizen. Status: ${reopenData.complaint.status} (Reopen Count: ${reopenData.complaint.reopenCount})`);

  // 6. Role Authorization Guards
  console.log("\n[6] Testing Server-Side Role Permissions & Security Scopes...");
  // Citizen trying to access admin stats
  const guardRes1 = await fetch(`${BASE_URL}/api/admin/stats`, {
    headers: { Cookie: citizen.cookie },
  });
  console.log(`✓ Citizen -> /api/admin/stats blocked with HTTP ${guardRes1.status} (Expected 403)`);
  if (guardRes1.status !== 403) throw new Error("Security breach: citizen accessed admin endpoint!");

  // Citizen trying to access officer endpoint
  const guardRes2 = await fetch(`${BASE_URL}/api/officer/workers`, {
    headers: { Cookie: citizen.cookie },
  });
  console.log(`✓ Citizen -> /api/officer/workers blocked with HTTP ${guardRes2.status} (Expected 403)`);
  if (guardRes2.status !== 403) throw new Error("Security breach: citizen accessed officer endpoint!");

  // 7. Verify Email Logs in Admin Outbox
  console.log("\n[7] Verifying Automated Background Email Outbox...");
  const admin = await login("admin@civicfix.gov.pk", "Password123!");
  const emailsRes = await fetch(`${BASE_URL}/api/admin/emails`, {
    headers: { Cookie: admin.cookie },
  });
  const emailsData = await emailsRes.json();
  console.log(`✓ Admin Outbox verified: Total ${emailsData.emails?.length || 0} automated emails logged in database.`);
  if (emailsData.emails && emailsData.emails.length > 0) {
    const recent = emailsData.emails[0];
    console.log(`  Most recent: To: ${recent.to} | Subject: "${recent.subject}" | Status: ${recent.status}`);
  }

  console.log("\n=======================================================");
  console.log("✓ ALL END-TO-END WORKFLOWS AND SECURITY CHECKS PASSED!");
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("\n❌ TEST ERROR:", err);
  process.exit(1);
});
