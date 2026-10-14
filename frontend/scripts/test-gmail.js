const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

function getCredentials() {
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  const envPath = path.resolve(__dirname, "../.env");
  if ((!user || !pass) && fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("SMTP_USER=")) {
        user = trimmed.slice(10).replace(/["']/g, "").trim();
      }
      if (trimmed.startsWith("SMTP_PASS=")) {
        pass = trimmed.slice(10).replace(/["']/g, "").trim();
      }
    }
  }

  return { user, pass: pass ? pass.replace(/\s+/g, "") : undefined };
}

async function testGmail() {
  const { user, pass } = getCredentials();
  if (!user || !pass) {
    console.error("❌ Missing SMTP_USER or SMTP_PASS in frontend/.env");
    return;
  }

  console.log(`🚀 Testing connection to Gmail SMTP for ${user}...`);

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass }
  });

  try {
    console.log("⏳ Verifying SMTP credentials with Google...");
    await transporter.verify();
    console.log("✅ Google SMTP Authentication SUCCESSFUL!");

    console.log("📨 Sending live test email to hassamjan607@gmail.com...");
    const info = await transporter.sendMail({
      from: `"CivicFix AI Alerts" <${user}>`,
      to: user,
      subject: "⚡ CivicFix AI: Officer Notification System Connected!",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <div style="background-color: #0d5c63; color: white; padding: 12px 20px; border-radius: 8px;">
            <h2 style="margin: 0;">CivicFix AI Municipal Platform</h2>
          </div>
          <div style="padding: 20px 0;">
            <p><strong>Assalam o Alaikum Officer Hassam Jan,</strong></p>
            <p>Your official Gmail notification channel is now <strong style="color: #16a34a;">LIVE & CONNECTED</strong>.</p>
            <div style="background-color: #f8fafc; border-left: 4px solid #0d5c63; padding: 12px 16px; margin: 16px 0;">
              <p style="margin: 0; font-weight: bold;">Status: Active Dispatch Officer</p>
              <p style="margin: 4px 0 0 0; color: #64748b; font-size: 13px;">You will receive real-time email alerts whenever citizens report sewage, drainage, or municipal hazards in your zone.</p>
            </div>
            <p>You can now test submitting complaints directly from the Citizen Portal!</p>
          </div>
          <hr style="border: none; border-top: 1px solid #e2e8f0;" />
          <p style="font-size: 12px; color: #94a3b8; margin-top: 12px;">CivicFix AI • Automated Municipal Governance Platform</p>
        </div>
      `,
      text: "Assalam o Alaikum Officer Hassam Jan, Your official Gmail notification channel is now LIVE & CONNECTED. You will receive real-time alerts whenever citizens report municipal issues."
    });

    console.log("🎉 Test email delivered successfully!");
    console.log("Message ID:", info.messageId);
    console.log("Response:", info.response);
  } catch (error) {
    console.error("❌ Gmail SMTP Error:", error);
  }
}

testGmail();
