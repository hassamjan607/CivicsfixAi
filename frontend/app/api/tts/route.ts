import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";

export const dynamic = "force-dynamic";

/**
 * Generate Neural Speech Audio using Microsoft Edge Neural TTS
 * with Google Translate TTS as high-speed resilient fallback.
 */
async function generateEdgeTts(text: string, voice: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn("edge-tts", ["--voice", voice, "--text", text, "--write-media", "-"]);
    const chunks: Buffer[] = [];
    let errOutput = "";

    proc.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    proc.stderr.on("data", (chunk: Buffer) => {
      errOutput += chunk.toString();
    });

    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {}
      reject(new Error("Edge-TTS process timeout"));
    }, 4500);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && chunks.length > 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`Edge-TTS failed with code ${code}: ${errOutput}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function generateGoogleTts(text: string, lang: string): Promise<Buffer> {
  const tl = lang.startsWith("ur") ? "ur" : "en";
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${tl}&client=tw-ob&q=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "audio/mpeg, audio/*",
    },
  });

  if (!res.ok) {
    throw new Error(`Google TTS request failed with status ${res.status}`);
  }

  const arrayBuf = await res.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const text = (searchParams.get("text") || searchParams.get("q") || "").trim();
    const lang = (searchParams.get("lang") || "ur").toLowerCase();
    const voiceParam = searchParams.get("voice");

    if (!text) {
      return NextResponse.json({ error: "Text parameter is required." }, { status: 400 });
    }

    const safeText = text.slice(0, 350);
    const isUrdu = lang.startsWith("ur") || /[\u0600-\u06FF]/.test(safeText);
    const selectedVoice = voiceParam || (isUrdu ? "ur-PK-UzmaNeural" : "en-US-JennyNeural");

    let audioBuffer: Buffer | null = null;

    // 1. Attempt Studio-Grade Microsoft Edge Neural Urdu Voice
    try {
      audioBuffer = await generateEdgeTts(safeText, selectedVoice);
    } catch (err: any) {
      console.warn("Edge-TTS notice, switching to secondary Google TTS stream:", err?.message || err);
    }

    // 2. High-speed resilient fallback
    if (!audioBuffer || audioBuffer.length === 0) {
      audioBuffer = await generateGoogleTts(safeText, isUrdu ? "ur" : "en");
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    return NextResponse.json({ error: "Failed to generate audio speech." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = (body.text || body.message || "").trim();
    const lang = (body.lang || "ur").toLowerCase();
    const voiceParam = body.voice;

    if (!text) {
      return NextResponse.json({ error: "Text parameter is required." }, { status: 400 });
    }

    const safeText = text.slice(0, 350);
    const isUrdu = lang.startsWith("ur") || /[\u0600-\u06FF]/.test(safeText);
    const selectedVoice = voiceParam || (isUrdu ? "ur-PK-UzmaNeural" : "en-US-JennyNeural");

    let audioBuffer: Buffer | null = null;

    try {
      audioBuffer = await generateEdgeTts(safeText, selectedVoice);
    } catch (err: any) {
      console.warn("Edge-TTS notice, switching to secondary Google TTS stream:", err?.message || err);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      audioBuffer = await generateGoogleTts(safeText, isUrdu ? "ur" : "en");
    }

    return new NextResponse(new Uint8Array(audioBuffer), {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: any) {
    console.error("TTS endpoint error:", error);
    return NextResponse.json({ error: "Failed to generate audio speech." }, { status: 500 });
  }
}
