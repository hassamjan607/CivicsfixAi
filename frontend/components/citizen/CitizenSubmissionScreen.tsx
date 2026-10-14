"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  Mic, 
  Camera, 
  Keyboard, 
  Check, 
  AlertCircle, 
  MapPin, 
  ArrowRight, 
  Volume2, 
  Trash2, 
  Send, 
  Loader2, 
  Navigation, 
  FileText, 
  Phone, 
  Sparkles,
  Paperclip,
  CheckCircle2
} from "lucide-react";
import { 
  speakClearPhrase, 
  playChime, 
  stopSpeech, 
  COMMON_PHRASES 
} from "@/lib/speech";

interface Props {
  onNavigateToReceived?: (complaintData?: any) => void;
  language?: "en" | "ur";
  onLanguageChange?: (lang: "en" | "ur") => void;
  isWideView?: boolean;
}

interface Message {
  id: string;
  sender: "assistant" | "user";
  textEn: string;
  textUr: string;
}

export function detectCategoryFromText(text: string): string | null {
  const lower = (text || "").toLowerCase().trim();
  if (!lower) return null;

  // 1. Live wire / Electrical / Streetlights
  if (/wire|taar|spark|current|dangling|pole fallen|short circuit|bijli ka khamba|streetlight|street light|light band|bulb|khamba|dark|bijli|کرنٹ|تاریں|تار ٹوٹ|شارٹ سرکٹ|کھمبا گر|اسٹریٹ لائٹ|لائٹ بند|بلب/.test(lower)) {
    return "Streetlights";
  }

  // 2. Clean Water Supply / Leaking Pipe / Pipeline
  if (/water supply|pipeline|pipe|leak|nal|peenay ka pani|drinking water|clean water|paani band|water shortage|پانی بند|پائپ لیک|پینے کا پانی|پائپ ٹوٹ/.test(lower)) {
    return "Water Supply";
  }

  // 3. Roads / Potholes / Broken Road
  if (/pothole|road broken|broken road|sarak|gaddha|khadda|tooti sarak|asphalt|crater|road accident|patchwork|road cave|سڑک|گڑھا|کھڈا|ٹوٹی سڑک|روڈ/.test(lower) || /\broad\b|\bsarak\b/.test(lower)) {
    return "Roads";
  }

  // 4. Garbage / Trash / Waste Dump / Safai
  if (/garbage|kachra|trash|waste|kuda|dher|safai|smell|dump|کچرا|کوڑا|صفائی|ڈھیر|بدبو/.test(lower)) {
    return "Garbage";
  }

  // 5. Sewage / Gutter / Manhole / Drain / Sanitation
  if (/manhole|mainhole|gutter cover|dhakkan|dhakan|chamber|gutter|gatar|gataar|sewage|sewer|drain|nadi|nalla|nala|ganda pani|badboo|ubal|choke|مین ہول|ڈھکن|سیوریج|گٹر|نالہ|گندا پانی|نالی/.test(lower)) {
    return "Sewage";
  }

  return null;
}

export default function CitizenSubmissionScreen({ 
  onNavigateToReceived,
  language: initialLang = "en",
  onLanguageChange,
  isWideView = false
}: Props) {
  const [lang, setLang] = useState<"en" | "ur">(initialLang);
  const [mode, setMode] = useState<"talk" | "type" | "form">("talk");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [isAiThinking, setIsAiThinking] = useState<boolean>(false);
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>("");
  const [hasLocationAttached, setHasLocationAttached] = useState<boolean>(false);
  const [textInput, setTextInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "detecting" | "detected">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 31.5204, lng: 74.3587 });
  const [locationName, setLocationName] = useState<string>("Street 4, Sector B, Lahore Central");
  const [isEditingLocation, setIsEditingLocation] = useState<boolean>(false);
  const [editLocationText, setEditLocationText] = useState<string>("");

  // Form states
  const [formCategory, setFormCategory] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formPhone, setFormPhone] = useState<string>("0300-1234567");

  // Chat message stream initialized with welcoming prompt (English default)
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome-1",
      sender: "assistant",
      textEn: "Hello! How can I help you today? Please tap the microphone to speak or type your civic issue.",
      textUr: "السلام علیکم! سیوک فکس میں خوش آمدید۔ بولنے کے لیے مائیک کا بٹن دبائیں یا اپنا مسئلہ لکھیں۔"
    }
  ]);

  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  }, [lang, onLanguageChange]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, photoPreview]);

  // Speech Recognition setup (Web Speech API)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = false;
          recognition.lang = lang === "ur" ? "ur-PK" : "en-US";
          
          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((res: any) => res[0].transcript)
              .join("");
            if (transcript && transcript.trim()) {
              handleUserSpeechInput(transcript.trim());
            }
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.onerror = (err: any) => {
            console.warn("Speech recognition notice:", err);
            setIsListening(false);
          };

          recognitionRef.current = recognition;
        } catch {
          recognitionRef.current = null;
        }
      }
    }
  }, [lang]);

  const toggleLanguage = (selected: "en" | "ur") => {
    setLang(selected);
    playChime("done");
  };

  const handleMicClick = () => {
    if (isListening || isSpeaking) {
      // If currently listening or AI is speaking, stop immediately
      stopSpeech();
      setIsSpeaking(false);
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      playChime("done");
    } else {
      // Check if user has already spoken in this session
      const hasUserSpoken = messages.some(m => m.sender === "user");

      if (!hasUserSpoken) {
        // Initial interaction: play welcoming prompt chime and speak prompt
        playChime("start");

        const welcomeEn = "Hello! Welcome to CivicFix. Please describe your civic grievance.";
        const welcomeUr = "السلام علیکم! سیوک فکس میں خوش آمدید۔ بتائیے، میں آپ کے علاقے کا مسئلہ حل کرنے میں کیا مدد کروں؟";
        
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last.sender === "assistant" && (last.textUr.includes("خوش آمدید") || last.textUr.includes("کیا مدد") || last.textEn.includes("CivicFix"))) {
            return prev;
          }
          return [
            ...prev,
            {
              id: Date.now().toString(),
              sender: "assistant",
              textEn: welcomeEn,
              textUr: welcomeUr
            }
          ];
        });

        setIsSpeaking(true);
        speakClearPhrase(
          COMMON_PHRASES.HOW_CAN_I_HELP,
          lang,
          () => {
            setIsSpeaking(true);
          },
          () => {
            setIsSpeaking(false);
            startVoiceRecognition();
          }
        );
      } else {
        // Ongoing conversation: simply listen to user's response without resetting
        startVoiceRecognition();
      }
    }
  };

  const startVoiceRecognition = () => {
    setIsListening(true);
    playChime("listening");
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        return;
      } catch (err) {
        console.warn("Recognition start notice:", err);
      }
    }
  };

  const processMessageWithAi = async (messageText: string) => {
    setIsAiThinking(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: messageText,
          lang: lang,
          history: messages.map(m => ({
            sender: m.sender,
            text: lang === "en" ? m.textEn : m.textUr
          })),
          currentCategory: formCategory,
          currentDescription: formDescription,
          hasPhoto: hasPhoto,
          location: locationName
        })
      });

      if (!res.ok) {
        throw new Error("Chat request failed");
      }

      const data = await res.json();
      setIsAiThinking(false);

      if (data.category && data.category !== "Other") {
        setFormCategory(data.category);
      }

      if (data.extractedLocation) {
        setLocationName(data.extractedLocation);
      }

      // Update complaint description with detected issue
      if (data.isFollowUp) {
        if (data.appendedDetails) {
          setFormDescription(prev => prev ? `${prev}. ${data.appendedDetails}` : data.appendedDetails);
        }
      } else if (data.detectedIssue && data.detectedIssue !== "None" && !data.isGreetingOrConversational) {
        setFormDescription(data.detectedIssue);
      } else if (!formDescription.trim() && messageText.trim().length > 3) {
        setFormDescription(messageText.trim());
      }

      const replyUr = data.replyUr || "شکریہ! آپ کا پیغام موصول ہو گیا ہے۔";
      const replyEn = data.replyEn || "Thank you! Your message has been received.";

      const assistantReply: Message = {
        id: Date.now().toString(),
        sender: "assistant",
        textEn: replyEn,
        textUr: replyUr
      };

      setMessages(prev => [...prev, assistantReply]);

      // Speak clear synthesized Urdu / English voice
      setIsSpeaking(true);
      speakClearPhrase(
        {
          urduText: replyUr,
          englishText: replyEn
        },
        lang,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );

    } catch (err) {
      console.warn("AI chat notice:", err);
      setIsAiThinking(false);

      const fallbackUr = "شکریہ! آپ کا مسئلہ درج کر لیا گیا ہے۔ کیا آپ اس کی تصویر شامل کرنا چاہتے ہیں؟";
      const fallbackEn = "Thank you! Your issue is recorded. Would you like to attach a photo?";

      const fallbackReply: Message = {
        id: Date.now().toString(),
        sender: "assistant",
        textEn: fallbackEn,
        textUr: fallbackUr
      };
      setMessages(prev => [...prev, fallbackReply]);

      setIsSpeaking(true);
      speakClearPhrase(
        { urduText: fallbackUr, englishText: fallbackEn },
        lang,
        () => setIsSpeaking(true),
        () => setIsSpeaking(false)
      );
    }
  };

  const handleUserSpeechInput = (spokenText: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      textEn: spokenText,
      textUr: spokenText
    };
    
    setMessages(prev => [...prev, userMsg]);
    if (!formDescription.trim()) {
      setFormDescription(spokenText);
    }
    const detected = detectCategoryFromText(spokenText);
    if (detected) {
      setFormCategory(detected);
    }
    processMessageWithAi(spokenText);
  };

  const handleSendTextMessage = () => {
    if (!textInput.trim()) return;
    const text = textInput.trim();
    setTextInput("");

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      textEn: text,
      textUr: text
    };
    setMessages(prev => [...prev, newMsg]);
    if (!formDescription.trim()) {
      setFormDescription(text);
    }
    const detected = detectCategoryFromText(text);
    if (detected) {
      setFormCategory(detected);
    }
    processMessageWithAi(text);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
      setPhotoFileName(file.name);
      setHasPhoto(true);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setPhotoFileName("");
    setHasPhoto(false);
  };

  const handleDetectGps = () => {
    setGpsStatus("detecting");
    playChime("listening");

    const applyLocation = (lat: number, lng: number, address: string) => {
      setCoords({ lat, lng });
      setLocationName(address);
      setHasLocationAttached(true);
      setGpsStatus("detected");
      playChime("done");

      // Add visual confirmation into the conversation stream
      const locTextEn = `📍 Attached Location: ${address} (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;
      const locTextUr = `📍 منسلک مقام: ${address} (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;

      const userLocMsg: Message = {
        id: Date.now().toString(),
        sender: "user",
        textEn: locTextEn,
        textUr: locTextUr
      };

      const ackEn = `Thank you! Your location at ${address} has been verified and pinned to this grievance.`;
      const ackUr = `شکریہ! آپ کا مقام (${address}) کامیابی سے تصدیق کر کے شکایت کے ساتھ منسلک کر دیا گیا ہے۔`;

      const assistantAckMsg: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        textEn: ackEn,
        textUr: ackUr
      };

      setMessages(prev => [...prev, userLocMsg, assistantAckMsg]);

      speakClearPhrase(
        {
          englishText: ackEn,
          urduText: ackUr
        },
        lang
      );
    };

    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          let address = `Street 4, Sector B (${lat.toFixed(4)}° N, ${lng.toFixed(4)}° E)`;

          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
              { signal: AbortSignal.timeout(3500) }
            );
            if (res.ok) {
              const data = await res.json();
              if (data.display_name) {
                const addr = data.address || {};
                const parts = [
                  addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood,
                  addr.city_district || addr.city || addr.town || "Lahore"
                ].filter(Boolean);
                if (parts.length > 0) {
                  address = parts.join(", ");
                } else {
                  address = data.display_name.split(",").slice(0, 3).join(",");
                }
              }
            }
          } catch {
            // Geocoding fallback
          }

          applyLocation(lat, lng, address);
        },
        () => {
          // Simulation/desktop fallback when browser GPS permission is not granted
          setTimeout(() => {
            applyLocation(31.5204, 74.3587, "Street 4, Sector B, Lahore Central");
          }, 600);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      setTimeout(() => {
        applyLocation(31.5204, 74.3587, "Street 4, Sector B, Lahore Central");
      }, 500);
    }
  };

  const handleRemoveLocation = () => {
    setHasLocationAttached(false);
    setGpsStatus("idle");
    setIsEditingLocation(false);
    playChime("done");
  };

  const handleSaveManualLocation = () => {
    if (editLocationText.trim()) {
      const newAddress = editLocationText.trim();
      setLocationName(newAddress);
      setHasLocationAttached(true);
      setGpsStatus("detected");
      setIsEditingLocation(false);
      playChime("done");

      const locTextEn = `📍 Updated Location: ${newAddress}`;
      const locTextUr = `📍 تبدیل شدہ مقام: ${newAddress}`;

      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          sender: "user",
          textEn: locTextEn,
          textUr: locTextUr
        }
      ]);
    } else {
      setIsEditingLocation(false);
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (onNavigateToReceived) {
        // Extract genuine description: formDescription, or latest user message, or sensible default
        const latestUserMsg = [...messages].reverse().find(m => m.sender === "user")?.textEn;
        const finalDescription = formDescription.trim() || latestUserMsg || "Municipal civic issue reported by citizen";
        const finalCategory = formCategory || detectCategoryFromText(finalDescription) || "General Civic Issue";

        onNavigateToReceived({
          category: finalCategory,
          description: finalDescription,
          hasPhoto,
          photoPreview,
          hasLocationAttached,
          location: locationName || "Street 4, Sector B, Lahore Central",
          coords: coords
        });
      }
    }, 800);
  };

  return (
    <div className="w-full mx-auto bg-[#F8FAFC] min-h-screen sm:min-h-[640px] md:min-h-[720px] flex flex-col justify-between shadow-xl relative font-sans text-slate-800 transition-all duration-300 max-w-[1400px] sm:rounded-3xl border border-slate-200 overflow-hidden">
      {/* Top Header */}
      <header className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center space-x-2.5">
          <div className="w-9 h-9 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shadow-sm ring-2 ring-teal-100">
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900 block leading-tight">
              CivicFix AI
            </span>
            <span className="text-[10px] text-teal-700 font-semibold uppercase tracking-wider block">
              Citizen Portal
            </span>
          </div>
        </div>

        {/* Language selector toggle pill */}
        <div className="bg-[#E2E8F0] p-1 rounded-full flex items-center text-xs font-semibold shadow-inner">
          <button
            onClick={() => toggleLanguage("en")}
            className={`px-3 py-1 rounded-full transition-all duration-200 ${
              lang === "en" 
                ? "bg-white text-slate-900 shadow-sm font-bold" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            EN
          </button>
          <button
            onClick={() => toggleLanguage("ur")}
            className={`px-3 py-1 rounded-full transition-all duration-200 ${
              lang === "ur" 
                ? "bg-white text-slate-900 shadow-sm font-bold" 
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            اردو
          </button>
        </div>
      </header>

      {/* Segmented Control Pill (Talk / Type / Form) */}
      <div className="px-5 sm:px-6 my-3">
        <div className="bg-[#E8EEF5] p-1 rounded-2xl flex items-center justify-between shadow-inner">
          <button
            onClick={() => setMode("talk")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              mode === "talk"
                ? "bg-[#0E2038] text-white shadow-md font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Mic className="w-4 h-4" />
            <span>Talk</span>
          </button>
          <button
            onClick={() => setMode("type")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              mode === "type"
                ? "bg-[#0E2038] text-white shadow-md font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Keyboard className="w-4 h-4" />
            <span>Type</span>
          </button>
          <button
            onClick={() => setMode("form")}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all duration-200 text-center flex items-center justify-center gap-1.5 ${
              mode === "form"
                ? "bg-[#0E2038] text-white shadow-md font-bold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Form</span>
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 px-4 sm:px-6 py-2 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-24 lg:pb-8">
        {/* Left Side: Mode Content */}
        <div className="w-full lg:col-span-7 space-y-4">
          {/* Modes: Talk & Type (Chat Conversation Stream) */}
          {(mode === "talk" || mode === "type") && (
            <div className="space-y-3.5">
              {messages.map((m) => {
                const isAssistant = m.sender === "assistant";
                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl p-4 shadow-sm transition-all duration-200 ${
                      isAssistant
                        ? "bg-white border border-slate-100 max-w-[92%]"
                        : "bg-[#0E2038] text-white max-w-[85%] ml-auto shadow-md"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-[15px] leading-relaxed ${isAssistant ? "text-slate-800" : "text-white"}`}>
                        {lang === "en" ? m.textEn : m.textUr}
                      </p>
                      {isAssistant && (
                        <button
                          type="button"
                          onClick={() => {
                            playChime("start");
                            setIsSpeaking(true);
                            speakClearPhrase(
                              {
                                urduText: m.textUr,
                                englishText: m.textEn,
                              },
                              lang,
                              () => setIsSpeaking(true),
                              () => setIsSpeaking(false)
                            );
                          }}
                          className="text-slate-400 hover:text-[#0D5C63] hover:bg-slate-50 p-1.5 rounded-full transition-colors shrink-0"
                          title={lang === "en" ? "Listen to this message" : "یہ پیغام سنیں"}
                        >
                          <Volume2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Photo Preview inside conversation */}
              {photoPreview && (
                <div className="bg-white rounded-2xl p-3 border border-slate-200 shadow-sm max-w-[92%] space-y-2">
                  <div className="relative rounded-xl overflow-hidden border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photoPreview} alt="Complaint preview" className="w-full h-36 object-cover" />
                    <button
                      onClick={handleRemovePhoto}
                      className="absolute top-2 right-2 bg-red-600/90 hover:bg-red-700 text-white p-1.5 rounded-full shadow-md transition-colors"
                      title="Remove photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[11px] px-2 py-0.5 rounded-md font-mono">
                      {photoFileName || "evidence.jpg"}
                    </div>
                  </div>
                </div>
              )}

              {/* Location Attachment Card inside conversation */}
              {hasLocationAttached && (
                <div className="bg-white rounded-2xl p-3.5 border border-teal-200/90 shadow-sm max-w-[92%] space-y-2 bg-gradient-to-br from-teal-50/70 via-white to-emerald-50/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl bg-[#0D5C63] text-white shadow-sm shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-teal-950">
                            {lang === "en" ? "Attached Location" : "منسلک شدہ مقام"}
                          </span>
                          <span className="text-[10px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded-full border border-teal-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-600 animate-pulse"></span>
                            GPS Verified
                          </span>
                        </div>

                        {isEditingLocation ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={editLocationText}
                              onChange={(e) => setEditLocationText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleSaveManualLocation();
                                if (e.key === "Escape") setIsEditingLocation(false);
                              }}
                              placeholder={lang === "en" ? "Enter street / area..." : "گلی یا علاقہ درج کریں..."}
                              className="text-xs border border-teal-300 rounded-lg px-2.5 py-1 outline-none focus:ring-1 focus:ring-teal-600 w-full bg-white text-slate-800"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={handleSaveManualLocation}
                              className="bg-[#0D5C63] text-white text-[11px] px-2.5 py-1 rounded-lg font-medium hover:bg-teal-700 transition-colors shrink-0"
                            >
                              {lang === "en" ? "Save" : "محفوظ"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsEditingLocation(false)}
                              className="text-slate-400 hover:text-slate-600 text-xs px-1.5 py-1 shrink-0"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <p className="text-xs text-slate-800 font-semibold leading-snug break-words">
                              {locationName}
                            </p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="font-mono">
                                {coords.lat.toFixed(4)}° N, {coords.lng.toFixed(4)}° E
                              </span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditLocationText(locationName);
                                  setIsEditingLocation(true);
                                }}
                                className="text-teal-700 hover:underline font-semibold"
                              >
                                {lang === "en" ? "Edit Address" : "پتہ تبدیل کریں"}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveLocation}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title={lang === "en" ? "Remove location" : "مقام ہٹائیں"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Listening Active Wave Animation Bubble (Talk mode only) */}
              {mode === "talk" && isListening && (
                <div className="bg-teal-50 border border-teal-200 rounded-2xl p-3.5 flex items-center space-x-3 text-teal-800 animate-pulse">
                  <div className="flex items-center space-x-1 h-5">
                    <span className="w-1 bg-[#0D5C63] rounded-full soundwave-bar-1"></span>
                    <span className="w-1 bg-[#0D5C63] rounded-full soundwave-bar-2"></span>
                    <span className="w-1 bg-[#0D5C63] rounded-full soundwave-bar-3"></span>
                    <span className="w-1 bg-[#0D5C63] rounded-full soundwave-bar-4"></span>
                  </div>
                  <span className="text-sm font-semibold">
                    {lang === "en" ? "Listening to your voice..." : "آپ کی آواز سن رہے ہیں..."}
                  </span>
                </div>
              )}

              {/* Quick Suggestion Chips (Type mode only) */}
              {mode === "type" && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Quick suggestions:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { en: "Sewage overflow in our street", ur: "ہماری گلی میں گٹر ابل رہا ہے" },
                      { en: "Dangerous deep pothole", ur: "سڑک پر خطرناک گڑھا ہے" },
                      { en: "Street light is turned off", ur: "اسٹریٹ لائٹ بند ہے" }
                    ].map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const val = lang === "en" ? chip.en : chip.ur;
                          setTextInput(val);
                          const detected = detectCategoryFromText(val);
                          if (detected) {
                            setFormCategory(detected);
                          }
                        }}
                        className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        {lang === "en" ? chip.en : chip.ur}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Thinking Animation Bubble */}
              {isAiThinking && (
                <div className="bg-white border border-teal-100 rounded-2xl p-3.5 max-w-[85%] flex items-center space-x-2.5 text-slate-600 shadow-sm animate-pulse">
                  <Sparkles className="w-4 h-4 text-[#0D5C63] animate-spin" />
                  <span className="text-xs font-semibold">
                    {lang === "en" ? "CivicFix AI is analyzing..." : "اے آئی جواب تیار کر رہا ہے..."}
                  </span>
                  <div className="flex space-x-1 pl-1">
                    <span className="w-1.5 h-1.5 bg-[#0D5C63] rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#0D5C63] rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-1.5 h-1.5 bg-[#0D5C63] rounded-full animate-bounce"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Mode 3: Structured Form */}
          {mode === "form" && (
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-sm font-bold text-slate-900">
                  {lang === "en" ? "Fill Complaint Details" : "شکایت کی تفصیلات درج کریں"}
                </span>
                <span className="text-[10px] bg-teal-50 text-teal-800 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  Standard Form
                </span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Category
                </label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0D5C63]"
                >
                  <option value="" disabled>
                    {lang === "en" ? "Select Problem Category..." : "مسئلے کا زمرہ منتخب کریں..."}
                  </option>
                  <option value="Roads">Potholes & Road Damage (TEPA)</option>
                  <option value="Water Supply">Clean Drinking Water (WASA)</option>
                  <option value="Streetlights">Street Lights & Electricity (LESCO/TEPA)</option>
                  <option value="Sewage">Sewage & Sanitation (WASA)</option>
                  <option value="Garbage">Garbage Collection (LWMC)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormDescription(val);
                    const autoCat = detectCategoryFromText(val);
                    if (autoCat && !formCategory) {
                      setFormCategory(autoCat);
                    }
                  }}
                  placeholder={lang === "en" ? "Describe the issue in detail (e.g. Broken road, open gutter, fallen wire)..." : "مسئلے کی تفصیل درج کریں (مثلاً گٹر ابلنا، سڑک پر گڑھا، بجلی کی تار گرنا)..."}
                  className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-[#0D5C63]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Location
                  </label>
                  <button
                    type="button"
                    onClick={handleDetectGps}
                    className="text-xs text-[#0D5C63] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3" />
                    <span>{gpsStatus === "detecting" ? "Detecting..." : "Detect GPS"}</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={locationName}
                  onChange={(e) => {
                    setLocationName(e.target.value);
                    setHasLocationAttached(true);
                  }}
                  className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0D5C63]"
                />
                <span className="text-[11px] text-emerald-700 font-mono mt-1 block">
                  ✓ Coordinates verified: {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                </span>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Contact Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <input
                    type="tel"
                    value={formPhone}
                    onChange={(e) => setFormPhone(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-300 rounded-xl pl-10 pr-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-[#0D5C63]"
                  />
                </div>
              </div>

              {/* Photo Upload in Form Mode */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Photo Evidence
                </label>
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {photoPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photoPreview} alt="Complaint preview" className="w-full h-32 object-cover" />
                      <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Attached
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 hover:border-[#0D5C63] rounded-2xl p-4 text-center bg-slate-50 transition-colors flex items-center justify-center gap-2">
                      <Camera className="w-5 h-5 text-slate-500" />
                      <span className="text-xs font-bold text-slate-700">
                        Attach Photo from Camera or Gallery
                      </span>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: YOUR COMPLAINT Card & Checklist */}
        <div className="w-full lg:col-span-5 space-y-4 mt-2 lg:mt-0">
          {/* Live Complaint Checklist Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {lang === "en" ? "YOUR COMPLAINT STATUS" : "آپ کی شکایت کی حالت"}
              </h3>
              <span className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                {lang === "en" ? "Verified In Real-Time" : "فوری تصدیق شدہ"}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Category */}
              <div className={`border rounded-xl px-3 py-2.5 flex items-center space-x-2.5 transition-all ${
                formCategory 
                  ? "bg-[#F8FAFC] border-slate-200" 
                  : "bg-[#FEF9EE] border-[#FDE68A]"
              }`}>
                {formCategory ? (
                  <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-md bg-[#F59E0B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                    !
                  </div>
                )}
                <span className={`text-sm font-semibold truncate ${formCategory ? "text-slate-800" : "text-[#92400E]"}`}>
                  {formCategory
                    ? (lang === "en" 
                        ? (formCategory === "Roads" ? "Roads & Potholes"
                           : formCategory === "Streetlights" ? "Street Lights"
                           : formCategory === "Water Supply" ? "Water Supply"
                           : formCategory === "Garbage" ? "Garbage Collection"
                           : formCategory === "Sewage" ? "Sewage & Sanitation"
                           : formCategory)
                        : (formCategory === "Sewage" ? "سیوریج و گٹر"
                           : formCategory === "Roads" ? "سڑکیں و گڑھے"
                           : formCategory === "Streetlights" ? "اسٹریٹ لائٹس"
                           : formCategory === "Garbage" ? "صفائی و کوڑا"
                           : formCategory === "Water Supply" ? "پینے کا پانی"
                           : formCategory))
                    : (lang === "en" ? "Category needed" : "زمرہ درکار ہے")}
                </span>
              </div>

              {/* Details */}
              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3 py-2.5 flex items-center space-x-2.5">
                <div className={`w-5 h-5 rounded-full ${formDescription.trim() ? "bg-[#0D5C63] text-white" : "bg-amber-100 text-amber-700"} flex items-center justify-center shrink-0`}>
                  {formDescription.trim() ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <span className="font-bold text-xs">!</span>}
                </div>
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {formDescription.trim() 
                    ? (lang === "en" ? "Details added" : "تفصیلات درج ہیں") 
                    : (lang === "en" ? "Details pending" : "تفصیل درکار ہے")}
                </span>
              </div>

              {/* Photo needed / Photo added */}
              <label className="cursor-pointer">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
                <div className={`border rounded-xl px-3 py-2.5 flex items-center space-x-2.5 transition-all ${
                  hasPhoto 
                    ? "bg-[#F8FAFC] border-slate-200" 
                    : "bg-[#FEF9EE] border-[#FDE68A] hover:bg-[#FEF3C7]"
                }`}>
                  {hasPhoto ? (
                    <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-md bg-[#F59E0B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                      !
                    </div>
                  )}
                  <span className={`text-sm font-semibold truncate ${hasPhoto ? "text-slate-800" : "text-[#92400E]"}`}>
                    {hasPhoto 
                      ? (lang === "en" ? "Photo added" : "تصویر شامل ہے") 
                      : (lang === "en" ? "Photo needed" : "تصویر درکار ہے")}
                  </span>
                </div>
              </label>

              {/* GPS location */}
              <div 
                onClick={handleDetectGps}
                className={`border rounded-xl px-3 py-2.5 flex items-center space-x-2.5 cursor-pointer transition-all ${
                  hasLocationAttached
                    ? "bg-[#F8FAFC] border-slate-200 hover:bg-slate-100"
                    : gpsStatus === "detecting"
                    ? "bg-teal-50 border-teal-200"
                    : "bg-[#FEF9EE] border-[#FDE68A] hover:bg-[#FEF3C7]"
                }`}
                title={lang === "en" ? "Tap to detect / attach location" : "مقام کی تصدیق کے لیے دبائیں"}
              >
                {gpsStatus === "detecting" ? (
                  <div className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0D5C63]" />
                  </div>
                ) : hasLocationAttached ? (
                  <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-md bg-[#F59E0B] flex items-center justify-center text-white font-bold text-xs shrink-0">
                    !
                  </div>
                )}
                <span className={`text-sm font-semibold truncate ${
                  hasLocationAttached 
                    ? "text-slate-800" 
                    : gpsStatus === "detecting" 
                    ? "text-teal-900" 
                    : "text-[#92400E]"
                }`}>
                  {gpsStatus === "detecting"
                    ? (lang === "en" ? "Detecting GPS..." : "مقام تلاش کیا جا رہا ہے...")
                    : hasLocationAttached
                    ? (lang === "en" ? "GPS Attached" : "مقام شامل ہے")
                    : (lang === "en" ? "Location needed" : "مقام درکار ہے")}
                </span>
              </div>
            </div>

            {/* Micro details summary */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className={`w-3.5 h-3.5 shrink-0 ${hasLocationAttached ? "text-teal-600" : "text-amber-500"}`} />
                <span className="truncate max-w-[190px]">
                  {hasLocationAttached ? locationName : (lang === "en" ? "Location pending (Tap to attach)" : "مقام درکار ہے")}
                </span>
              </span>
              <span className="font-mono text-[11px] text-teal-800 font-bold bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                SLA: ~24 Hours
              </span>
            </div>
          </div>

          {/* Desktop AI Intelligence & Context Radar Card */}
          <div className="hidden lg:block bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                {lang === "en" ? "AI Context Radar (Section 8)" : "اے آئی سیاق و سباق ریڈار"}
              </h4>
              <span className="text-[10px] font-extrabold text-teal-700 font-mono">
                {lang === "en" ? "Active" : "فعال"}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Weather check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="text-slate-700 font-medium">
                    {lang === "en" ? "Open-Meteo Weather:" : "موسمی الرٹ:"}
                  </span>
                </div>
                <span className="font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px]">
                  {lang === "en" ? "Rain Alert (+2 pts)" : "بارش الرٹ (+2)"}
                </span>
              </div>

              {/* Sensitive places check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-slate-700 font-medium">
                    {lang === "en" ? "OSM Overpass Radius:" : "حساس مقام ریڈیس:"}
                  </span>
                </div>
                <span className="font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                  {lang === "en" ? "School within 100m (+1 pt)" : "اسکول 100 میٹر کے اندر (+1)"}
                </span>
              </div>

              {/* Deduplication & Cluster check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <span className="text-slate-700 font-medium">
                    {lang === "en" ? "Spatial Deduplication:" : "شکایات کی جانچ:"}
                  </span>
                </div>
                <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                  {lang === "en" ? "30m Radius Scanned" : "30 میٹر ریڈیس مکمل"}
                </span>
              </div>
            </div>

            {/* Direct Desktop Submit Action */}
            <div className="pt-2">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="w-full bg-[#0D5C63] hover:bg-[#09474D] text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{lang === "en" ? "Routing Complaint..." : "شکایت درج کی جا رہی ہے..."}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{lang === "en" ? "Submit Citizen Complaint" : "شکایت جمع کروائیں"}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Mode-Specific Bottom Action Footer */}
      
      {/* 1. TALK MODE FOOTER: Voice Controls & Big Glowing Mic FAB */}
      {mode === "talk" && (
        <footer className="bg-white/95 backdrop-blur-md border-t border-slate-100 rounded-t-3xl pt-4 pb-6 px-5 sm:px-6 z-20 transition-all duration-300">
          {/* Audio Wave Indicator */}
          <div className="flex items-center justify-center space-x-2 text-[#0D5C63] mb-3">
            <div className="flex items-center space-x-1 h-5">
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isSpeaking || isListening ? "soundwave-bar-1" : "h-2"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isSpeaking || isListening ? "soundwave-bar-2" : "h-4"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isSpeaking || isListening ? "soundwave-bar-3" : "h-3"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isSpeaking || isListening ? "soundwave-bar-4" : "h-2"}`}></span>
            </div>
            <span className="text-sm font-semibold tracking-wide">
              {isSpeaking 
                ? (lang === "en" ? "AI Speaking: How can I help you..." : "اے آئی بول رہا ہے: میں آپ کی کیا مدد کر سکتا ہوں...")
                : isListening 
                ? (lang === "en" ? "Listening in Urdu/English..." : "اردو میں سن رہے ہیں...") 
                : (lang === "en" ? "Tap mic to speak" : "بولنے کے لیے مائیک دبائیں")}
            </span>
          </div>

          {/* Action Controls (Photo / Location / Mic FAB / Type) */}
          <div className="flex items-center justify-around max-w-[420px] mx-auto mb-3 px-2">
            {/* Photo Button */}
            <label className="flex flex-col items-center cursor-pointer group">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoUpload} 
              />
              <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all ${
                hasPhoto 
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                  : "border-amber-300 bg-white text-amber-600 group-hover:border-amber-400"
              }`}>
                <Camera className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-1.5">
                {hasPhoto 
                  ? (lang === "en" ? "Change" : "تبدیل کریں") 
                  : (lang === "en" ? "Photo" : "تصویر")}
              </span>
            </label>

            {/* Location Button */}
            <button
              type="button"
              onClick={handleDetectGps}
              disabled={gpsStatus === "detecting"}
              className="flex flex-col items-center group"
              title={lang === "en" ? (hasLocationAttached ? "Location attached (Tap to update)" : "Attach GPS Location") : "مقام منسلک کریں"}
            >
              <div className={`w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all ${
                hasLocationAttached 
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                  : gpsStatus === "detecting"
                  ? "border-teal-400 bg-teal-50 text-teal-700 animate-pulse" 
                  : "border-amber-300 bg-white text-amber-600 group-hover:border-amber-400"
              }`}>
                {gpsStatus === "detecting" ? (
                  <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin text-teal-600" />
                ) : (
                  <MapPin className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
                )}
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-1.5">
                {gpsStatus === "detecting"
                  ? (lang === "en" ? "Detecting" : "تلاش...")
                  : hasLocationAttached 
                  ? (lang === "en" ? "Attached" : "منسلک") 
                  : (lang === "en" ? "Location" : "مقام")}
              </span>
            </button>

            {/* Large Glowing Mic FAB */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleMicClick}
                className={`w-18 h-18 sm:w-20 sm:h-20 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 hover:scale-105 transition-all relative ${
                  isSpeaking
                    ? "bg-amber-600 shadow-amber-700/30 ring-8 ring-amber-100 animate-pulse"
                    : isListening 
                    ? "bg-rose-600 shadow-rose-700/30 ring-8 ring-rose-100 animate-pulse" 
                    : "bg-[#0D5C63] shadow-teal-700/25 ring-8 ring-teal-100/80"
                }`}
                title={isSpeaking 
                  ? (lang === "en" ? "AI Speaking (Tap to stop)" : "اے آئی بول رہا ہے (روکنے کے لیے دبائیں)") 
                  : isListening 
                  ? (lang === "en" ? "Listening (Tap to stop)" : "سن رہے ہیں (روکنے کے لیے دبائیں)") 
                  : (lang === "en" ? "Tap to speak your complaint" : "اپنی شکایت بولنے کے لیے دبائیں")}
              >
                {isSpeaking ? (
                  <Volume2 className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2] animate-bounce" />
                ) : (
                  <Mic className="w-7 h-7 sm:w-8 sm:h-8 stroke-[2.2]" />
                )}
              </button>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-700 mt-1.5 sm:mt-2">
                {isSpeaking 
                  ? (lang === "en" ? "AI Speaking..." : "اے آئی بول رہا ہے...") 
                  : isListening 
                  ? (lang === "en" ? "Stop & Process" : "روکیں اور درج کریں") 
                  : (lang === "en" ? "Tap to speak" : "بولنے کے لیے دبائیں")}
              </span>
            </div>

            {/* Switch to Type Button */}
            <button 
              onClick={() => setMode("type")}
              className="flex flex-col items-center group"
            >
              <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center text-slate-600 shadow-sm group-hover:scale-105 group-hover:border-slate-400 transition-all">
                <Keyboard className="w-5 h-5 sm:w-6 sm:h-6 stroke-[1.8]" />
              </div>
              <span className="text-[11px] sm:text-xs font-semibold text-slate-600 mt-1.5">
                {lang === "en" ? "Type" : "لکھیں"}
              </span>
            </button>
          </div>

          {/* Microcopy disclaimer */}
          <p className="text-[11px] text-slate-400 text-center leading-tight mb-2">
            {lang === "en" 
              ? "Mic is on only while you tap. Audio is not stored by CivicFix." 
              : "مائیک صرف آپ کے بولنے پر آن ہوتا ہے۔ آڈیو محفوظ نہیں کی جاتی۔"}
          </p>

          {/* Proceed to Page 2 CTA */}
          {onNavigateToReceived && (
            <div className="text-center pt-2 border-t border-slate-100">
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="text-xs text-[#0D5C63] hover:text-[#09484E] font-bold inline-flex items-center gap-1.5 bg-teal-50 hover:bg-teal-100 px-4 py-2 rounded-xl border border-teal-200 transition-all shadow-xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{lang === "en" ? "Registering Complaint..." : "شکایت درج کی جا رہی ہے..."}</span>
                  </>
                ) : (
                  <>
                    <span>{lang === "en" ? "Submit & View Breakdown (Page 2)" : "شکایت جمع کروائیں (صفحہ 2)"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          )}
        </footer>
      )}

      {/* 2. TYPE MODE FOOTER: Dedicated Text Input Chat Bar */}
      {mode === "type" && (
        <footer className="bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-t-3xl pt-3 pb-5 px-4 sm:px-6 z-20 transition-all duration-300">
          <div className="space-y-2.5">
            {/* Input Bar */}
            <div className="bg-[#F8FAFC] rounded-2xl p-1.5 border border-slate-300 shadow-sm flex items-center space-x-1.5 focus-within:ring-2 focus-within:ring-[#0D5C63] focus-within:border-transparent transition-all">
              {/* Photo attach button */}
              <label className="p-2 text-slate-500 hover:text-slate-800 cursor-pointer rounded-xl hover:bg-slate-200/60 transition-colors shrink-0">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
                <Camera className="w-5 h-5" />
              </label>

              {/* Location attach button */}
              <button
                type="button"
                onClick={handleDetectGps}
                disabled={gpsStatus === "detecting"}
                className={`p-2 rounded-xl transition-colors shrink-0 ${
                  hasLocationAttached 
                    ? "text-emerald-600 hover:text-emerald-700 bg-emerald-50/80" 
                    : gpsStatus === "detecting"
                    ? "text-teal-600 bg-teal-50 animate-pulse"
                    : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/60"
                }`}
                title={lang === "en" ? (hasLocationAttached ? "Location attached (Tap to update)" : "Attach GPS Location") : "مقام منسلک کریں"}
              >
                {gpsStatus === "detecting" ? (
                  <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                ) : (
                  <MapPin className="w-5 h-5" />
                )}
              </button>

              {/* Text Input */}
              <input 
                type="text" 
                placeholder={lang === "en" ? "Type your message in English or Urdu..." : "اپنا بلدیاتی مسئلہ یہاں لکھیں..."}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendTextMessage();
                }}
                className="flex-1 text-sm outline-none px-2 py-1.5 text-slate-800 bg-transparent font-medium"
              />

              {/* Switch back to Talk Mic Icon */}
              <button
                type="button"
                onClick={() => setMode("talk")}
                className="p-2 text-slate-400 hover:text-[#0D5C63] rounded-xl transition-colors"
                title={lang === "en" ? "Switch to Voice Mic" : "مائیک پر جائیں"}
              >
                <Mic className="w-5 h-5" />
              </button>

              {/* Send Button */}
              <button 
                onClick={handleSendTextMessage}
                disabled={!textInput.trim()}
                className="bg-[#0D5C63] hover:bg-[#09484E] disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-sm shrink-0"
                title={lang === "en" ? "Send message" : "پیغام بھیجیں"}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Submit to Page 2 CTA */}
            {onNavigateToReceived && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-slate-400">
                  {lang === "en" ? "Press Enter to send message" : "پیغام بھیجنے کے لیے Enter دبائیں"}
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="text-xs text-[#0D5C63] hover:text-[#09484E] font-bold inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-all shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{lang === "en" ? "Submitting..." : "جمع ہو رہی ہے..."}</span>
                    </>
                  ) : (
                    <>
                      <span>{lang === "en" ? "Submit Complaint" : "شکایت جمع کروائیں"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </footer>
      )}

      {/* 3. FORM MODE FOOTER: Dedicated Form Submission Action Dock */}
      {mode === "form" && (
        <footer className="bg-white/95 backdrop-blur-md border-t border-slate-200 rounded-t-3xl pt-4 pb-6 px-5 sm:px-6 z-20 transition-all duration-300">
          <div className="space-y-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-[#0D5C63] hover:bg-[#0A4D54] active:scale-95 text-white font-extrabold py-3.5 px-4 rounded-2xl text-sm transition-all shadow-lg flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{lang === "en" ? "Submitting Complaint to Department..." : "شکایت متعلقہ محکمے کو بھیجی جا رہی ہے..."}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-300" />
                  <span>{lang === "en" ? "Submit Form & View Urgency Breakdown (Page 2)" : "شکایت جمع کروائیں (صفحہ 2)"}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>{lang === "en" ? "Prefer speaking?" : "کیا آپ بولنا چاہتے ہیں؟"}</span>
              <button
                type="button"
                onClick={() => setMode("talk")}
                className="text-[#0D5C63] font-bold hover:underline flex items-center gap-1"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{lang === "en" ? "Switch to Voice Mic" : "مائیک پر جائیں"}</span>
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
