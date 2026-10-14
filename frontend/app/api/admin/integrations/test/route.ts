import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import nodemailer from "nodemailer";

interface ServiceDiagnostic {
  service: string;
  status: "connected" | "misconfigured" | "unconfigured" | "degraded" | "development_mode";
  latencyMs?: number;
  message: string;
  details?: Record<string, any>;
}

/**
 * Diagnostic health check across all 4 external integrations:
 * 1. Email (Resend / SMTP / Console)
 * 2. Groq Llama 3.3 (Text NLP)
 * 3. Google Gemini 1.5 Flash (Vision & PII)
 * 4. Meta WhatsApp Business Cloud API
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Access denied. Admin privileges required." }, { status: 403 });
    }

    const startTime = Date.now();
    const results: Record<string, ServiceDiagnostic> = {};

    // ---------------------------------------------------------
    // 1. Email Service Test (Resend / SMTP / Console)
    // ---------------------------------------------------------
    const emailProvider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();
    const resendApiKey = process.env.RESEND_API_KEY || process.env.EMAIL_API_KEY;

    if (emailProvider === "resend") {
      if (!resendApiKey) {
        results.email = {
          service: "Email (Resend)",
          status: "misconfigured",
          message: "EMAIL_PROVIDER is set to 'resend' but RESEND_API_KEY is missing in environment.",
        };
      } else {
        const t0 = Date.now();
        try {
          const res = await fetch("https://api.resend.com/domains", {
            headers: { Authorization: `Bearer ${resendApiKey}` },
          });
          const latency = Date.now() - t0;
          if (res.ok) {
            const data = await res.json().catch(() => ({}));
            results.email = {
              service: "Email (Resend)",
              status: "connected",
              latencyMs: latency,
              message: `Connected successfully to Resend API. Active verified domains: ${data?.data?.length || 0}.`,
              details: {
                from: process.env.EMAIL_FROM || "alerts@civicfix.gov.pk",
                domainsCount: data?.data?.length || 0,
              },
            };
          } else {
            results.email = {
              service: "Email (Resend)",
              status: "misconfigured",
              latencyMs: latency,
              message: `Resend authentication failed (HTTP ${res.status}). Verify your API key at resend.com/api-keys.`,
            };
          }
        } catch (err: any) {
          results.email = {
            service: "Email (Resend)",
            status: "degraded",
            message: `Network failure connecting to Resend: ${err?.message || String(err)}`,
          };
        }
      }
    } else if (emailProvider === "smtp") {
      const host = process.env.SMTP_HOST;
      const port = parseInt(process.env.SMTP_PORT || "587", 10);
      if (!host) {
        results.email = {
          service: "Email (SMTP)",
          status: "misconfigured",
          message: "EMAIL_PROVIDER is set to 'smtp' but SMTP_HOST is not configured.",
        };
      } else {
        const t0 = Date.now();
        try {
          const transporter = nodemailer.createTransport({
            host,
            port,
            secure: process.env.SMTP_SECURE === "true" || port === 465,
            auth: process.env.SMTP_USER ? {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            } : undefined,
            connectionTimeout: 4000,
          });
          await transporter.verify();
          results.email = {
            service: "Email (SMTP)",
            status: "connected",
            latencyMs: Date.now() - t0,
            message: `SMTP server ${host}:${port} responded and authenticated successfully.`,
          };
        } catch (err: any) {
          results.email = {
            service: "Email (SMTP)",
            status: "degraded",
            message: `SMTP connection to ${host}:${port} failed: ${err?.message || String(err)}`,
          };
        }
      }
    } else {
      results.email = {
        service: "Email (Console Mode)",
        status: "development_mode",
        message: "Email provider running in local development console mode. Emails are logged to terminal without sending.",
        details: { provider: "console" },
      };
    }

    // ---------------------------------------------------------
    // 2. Groq Llama 3.3 Test (Primary NLP Triage Engine)
    // ---------------------------------------------------------
    const groqKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!groqKey) {
      results.groq = {
        service: "Groq Llama 3.3",
        status: "unconfigured",
        message: "GROQ_API_KEY not configured. System is falling back to Gemini / simulated triage.",
      };
    } else {
      const t0 = Date.now();
      try {
        const res = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${groqKey}` },
        });
        const latency = Date.now() - t0;
        if (res.ok) {
          results.groq = {
            service: "Groq Llama 3.3",
            status: "connected",
            latencyMs: latency,
            message: `Groq Cloud API connected. Primary model: ${groqModel}.`,
            details: { model: groqModel },
          };
        } else {
          results.groq = {
            service: "Groq Llama 3.3",
            status: "misconfigured",
            latencyMs: latency,
            message: `Groq API returned HTTP ${res.status}. Please check your GROQ_API_KEY.`,
          };
        }
      } catch (err: any) {
        results.groq = {
          service: "Groq Llama 3.3",
          status: "degraded",
          message: `Network error pinging Groq Cloud: ${err?.message || String(err)}`,
        };
      }
    }

    // ---------------------------------------------------------
    // 3. Google Gemini 1.5 Flash Test (Vision & PII Blurring)
    // ---------------------------------------------------------
    const googleKey = process.env.GOOGLE_API_KEY;
    const geminiModel = process.env.GEMINI_MODEL || "gemini-1.5-flash";

    if (!googleKey) {
      results.gemini = {
        service: "Google Gemini Flash",
        status: "unconfigured",
        message: "GOOGLE_API_KEY not configured. Vision analysis and damage severity running in fallback mode.",
      };
    } else {
      const t0 = Date.now();
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${googleKey}`);
        const latency = Date.now() - t0;
        if (res.ok) {
          results.gemini = {
            service: "Google Gemini Flash",
            status: "connected",
            latencyMs: latency,
            message: `Google Generative AI Studio connected. Primary multimodal model: ${geminiModel}.`,
            details: { model: geminiModel },
          };
        } else {
          results.gemini = {
            service: "Google Gemini Flash",
            status: "misconfigured",
            latencyMs: latency,
            message: `Google AI Studio returned HTTP ${res.status}. Check your GOOGLE_API_KEY.`,
          };
        }
      } catch (err: any) {
        results.gemini = {
          service: "Google Gemini Flash",
          status: "degraded",
          message: `Network error connecting to Google AI Studio: ${err?.message || String(err)}`,
        };
      }
    }

    // ---------------------------------------------------------
    // 4. Meta WhatsApp Business Cloud API Test
    // ---------------------------------------------------------
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!waToken || !waPhoneId) {
      results.whatsapp = {
        service: "Meta WhatsApp Cloud API",
        status: "unconfigured",
        message: "WHATSAPP_ACCESS_TOKEN or WHATSAPP_PHONE_NUMBER_ID not configured.",
      };
    } else {
      const t0 = Date.now();
      try {
        const res = await fetch(`https://graph.facebook.com/v20.0/${waPhoneId}?access_token=${waToken}`);
        const latency = Date.now() - t0;
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          results.whatsapp = {
            service: "Meta WhatsApp Cloud API",
            status: "connected",
            latencyMs: latency,
            message: `WhatsApp Business Cloud API active. Verified phone: ${data?.display_phone_number || waPhoneId}.`,
            details: {
              phoneId: waPhoneId,
              verifiedName: data?.verified_name || "CivicFix AI",
            },
          };
        } else {
          results.whatsapp = {
            service: "Meta WhatsApp Cloud API",
            status: "misconfigured",
            latencyMs: latency,
            message: `WhatsApp Graph API returned HTTP ${res.status}. Check System User Token or Phone Number ID.`,
          };
        }
      } catch (err: any) {
        results.whatsapp = {
          service: "Meta WhatsApp Cloud API",
          status: "degraded",
          message: `Network error contacting Meta Graph API: ${err?.message || String(err)}`,
        };
      }
    }

    const totalDurationMs = Date.now() - startTime;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      durationMs: totalDurationMs,
      services: results,
    });
  } catch (err: any) {
    console.error("Diagnostic health check error:", err);
    return NextResponse.json({ error: "Failed to run integrations diagnostic." }, { status: 500 });
  }
}
