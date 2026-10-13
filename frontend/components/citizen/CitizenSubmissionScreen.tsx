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

export default function CitizenSubmissionScreen({ 
  onNavigateToReceived,
  language: initialLang = "en",
  onLanguageChange,
  isWideView = false
}: Props) {
  const [lang, setLang] = useState<"en" | "ur">(initialLang);
  const [mode, setMode] = useState<"talk" | "type" | "form">("talk");
  const [isListening, setIsListening] = useState<boolean>(false);
  const [hasPhoto, setHasPhoto] = useState<boolean>(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFileName, setPhotoFileName] = useState<string>("");
  const [textInput, setTextInput] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "detecting" | "detected">("detected");
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat: 31.5204, lng: 74.3587 });
  const [locationName, setLocationName] = useState<string>("Street 4, Lahore Central");

  // Form states
  const [formCategory, setFormCategory] = useState<string>("Sewage");
  const [formDescription, setFormDescription] = useState<string>("Hamari gali mein gutter ubal raha hai aur paani gharon ke samne jama ho gaya hai.");
  const [formPhone, setFormPhone] = useState<string>("0300-1234567");

  // Chat message stream
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      sender: "assistant",
      textEn: "Assalam o alaikum. Apni problem bataein, main sun raha hoon.",
      textUr: "السلام علیکم۔ اپنی پریشانی بتائیں، میں سن رہا ہوں۔"
    },
    {
      id: "2",
      sender: "user",
      textEn: "Hamari gali mein gutter ubal raha hai.",
      textUr: "ہماری گلی میں گٹر ابل رہا ہے۔"
    },
    {
      id: "3",
      sender: "assistant",
      textEn: "Samajh gaya, sewage ka masla hai. Kya aap ek photo bhej sakte hain?",
      textUr: "سمجھ گیا، سیوریج کا مسئلہ ہے۔ کیا آپ ایک تصویر بھیج سکتے ہیں؟"
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

  // Speech Recognition setup (Web Speech API with Fallback simulation)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = false;
          recognition.interimResults = true;
          recognition.lang = lang === "ur" ? "ur-PK" : "en-US";
          
          recognition.onresult = (event: any) => {
            const transcript = Array.from(event.results)
              .map((res: any) => res[0].transcript)
              .join("");
            if (event.results[0].isFinal) {
              handleUserSpeechInput(transcript);
            }
          };

          recognition.onend = () => {
            setIsListening(false);
          };

          recognition.onerror = () => {
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
  };

  const handleMicClick = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
    } else {
      setIsListening(true);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
          return;
        } catch {
          // If native mic fails, run realistic simulation
        }
      }

      // High-fidelity speech simulation fallback
      setTimeout(() => {
        handleUserSpeechInput(
          lang === "ur" 
            ? "گٹر کا گندا پانی سڑک پر بہہ رہا ہے اور بدبو آ رہی ہے" 
            : "Gutter ka pani sarak par beh raha hai aur badboo hai"
        );
        setIsListening(false);
      }, 3000);
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

    // Assistant response
    setTimeout(() => {
      const assistantReply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        textEn: "Shukriya! Masla register ho raha hai. Photo shamil karein ya foran darj karein.",
        textUr: "شکریہ! مسئلہ رجسٹر ہو رہا ہے۔ تصویر شامل کریں یا فوراً درج کریں۔"
      };
      setMessages(prev => [...prev, assistantReply]);

      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        try {
          const utter = new SpeechSynthesisUtterance(assistantReply.textEn);
          utter.rate = 1.0;
          window.speechSynthesis.speak(utter);
        } catch {}
      }
    }, 600);
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

    setTimeout(() => {
      const reply: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        textEn: "Maine note kar liya hai. Kya location Street 4, Lahore hi hai?",
        textUr: "میں نے نوٹ کر لیا ہے۔ کیا مقام اسٹریٹ 4، لاہور ہی ہے؟"
      };
      setMessages(prev => [...prev, reply]);
    }, 500);
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
    if (typeof navigator !== "undefined" && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setLocationName(`GPS: ${pos.coords.latitude.toFixed(4)}° N, ${pos.coords.longitude.toFixed(4)}° E`);
          setGpsStatus("detected");
        },
        () => {
          setTimeout(() => {
            setCoords({ lat: 31.5204, lng: 74.3587 });
            setLocationName("Street 4, Sector B, Lahore Central");
            setGpsStatus("detected");
          }, 600);
        },
        { timeout: 5000 }
      );
    } else {
      setTimeout(() => {
        setGpsStatus("detected");
      }, 500);
    }
  };

  const handleSubmit = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      if (onNavigateToReceived) {
        onNavigateToReceived({
          category: formCategory,
          description: formDescription,
          hasPhoto,
          photoPreview,
          location: locationName
        });
      }
    }, 800);
  };

  return (
    <div className="w-full mx-auto bg-[#F8FAFC] min-h-screen sm:min-h-[640px] md:min-h-[720px] flex flex-col justify-between shadow-xl relative font-sans text-slate-800 transition-all duration-300 max-w-full lg:max-w-6xl sm:rounded-3xl border border-slate-200 overflow-hidden">
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
                    <p className={`text-[15px] leading-relaxed ${isAssistant ? "text-slate-800" : "text-white"}`}>
                      {lang === "en" ? m.textEn : m.textUr}
                    </p>
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
                        }}
                        className="text-[11px] font-semibold bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        {lang === "en" ? chip.en : chip.ur}
                      </button>
                    ))}
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
                  <option value="Sewage">Sewage & Sanitation (WASA)</option>
                  <option value="Roads">Potholes & Road Damage (TEPA)</option>
                  <option value="Streetlights">Street Lights & Electricity (LESCO)</option>
                  <option value="Garbage">Garbage Collection (LWMC)</option>
                  <option value="Water Supply">Clean Drinking Water</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block mb-1.5">
                  Problem Description
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the issue in detail..."
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
                  onChange={(e) => setLocationName(e.target.value)}
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
                YOUR COMPLAINT STATUS
              </h3>
              <span className="text-[10px] font-bold bg-teal-50 text-teal-800 px-2 py-0.5 rounded-full border border-teal-200">
                Verified In Real-Time
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2.5">
              {/* Category */}
              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3 py-2.5 flex items-center space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="text-sm font-semibold text-slate-800 truncate">
                  {formCategory || "Sewage"}
                </span>
              </div>

              {/* Details */}
              <div className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3 py-2.5 flex items-center space-x-2.5">
                <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="text-sm font-semibold text-slate-800">
                  Details
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
                    {hasPhoto ? "Photo added" : "Photo needed"}
                  </span>
                </div>
              </label>

              {/* GPS location */}
              <div 
                onClick={handleDetectGps}
                className="bg-[#F8FAFC] border border-slate-200/80 rounded-xl px-3 py-2.5 flex items-center space-x-2.5 cursor-pointer hover:bg-slate-100 transition-colors"
                title="Tap to re-verify location"
              >
                <div className="w-5 h-5 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shrink-0">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
                <span className="text-sm font-semibold text-slate-800 truncate">
                  GPS location
                </span>
              </div>
            </div>

            {/* Micro details summary */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1 font-medium">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span className="truncate max-w-[190px]">{locationName}</span>
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
                AI Context Radar (Section 8)
              </h4>
              <span className="text-[10px] font-extrabold text-teal-700 font-mono">
                Active
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {/* Weather check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                  <span className="text-slate-700 font-medium">Open-Meteo Weather:</span>
                </div>
                <span className="font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-200 text-[11px]">
                  Rain Alert (+2 pts)
                </span>
              </div>

              {/* Sensitive places check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <span className="text-slate-700 font-medium">OSM Overpass Radius:</span>
                </div>
                <span className="font-semibold text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-[11px]">
                  School within 100m (+1 pt)
                </span>
              </div>

              {/* Deduplication & Cluster check */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <span className="text-slate-700 font-medium">Spatial Deduplication:</span>
                </div>
                <span className="font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-[11px]">
                  30m Radius Scanned
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
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isListening ? "soundwave-bar-1" : "h-2"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isListening ? "soundwave-bar-2" : "h-4"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isListening ? "soundwave-bar-3" : "h-3"}`}></span>
              <span className={`w-1 bg-[#0D5C63] rounded-full ${isListening ? "soundwave-bar-4" : "h-2"}`}></span>
            </div>
            <span className="text-sm font-semibold tracking-wide">
              {isListening 
                ? (lang === "en" ? "Listening in Urdu/English..." : "اردو میں سن رہے ہیں...") 
                : (lang === "en" ? "Tap mic to speak" : "بولنے کے لیے مائیک دبائیں")}
            </span>
          </div>

          {/* Action Controls (Photo / Mic FAB / Type) */}
          <div className="flex items-center justify-around max-w-[340px] mx-auto mb-3">
            {/* Photo Button */}
            <label className="flex flex-col items-center cursor-pointer group">
              <input 
                type="file" 
                accept="image/*" 
                className="hidden" 
                onChange={handlePhotoUpload} 
              />
              <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all ${
                hasPhoto 
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700" 
                  : "border-amber-300 bg-white text-amber-600 group-hover:border-amber-400"
              }`}>
                <Camera className="w-6 h-6 stroke-[1.8]" />
              </div>
              <span className="text-xs font-semibold text-slate-600 mt-1.5">
                {hasPhoto ? "Change" : "Photo"}
              </span>
            </label>

            {/* Large Glowing Mic FAB */}
            <div className="flex flex-col items-center">
              <button
                onClick={handleMicClick}
                className={`w-20 h-20 rounded-full text-white flex items-center justify-center shadow-xl active:scale-95 hover:scale-105 transition-all relative ${
                  isListening 
                    ? "bg-rose-600 shadow-rose-700/30 ring-8 ring-rose-100 animate-pulse" 
                    : "bg-[#0D5C63] shadow-teal-700/25 ring-8 ring-teal-100/80"
                }`}
                title={isListening ? "Tap to stop recording" : "Tap to speak your complaint"}
              >
                <Mic className="w-8 h-8 stroke-[2.2]" />
              </button>
              <span className="text-xs font-semibold text-slate-700 mt-2">
                {isListening ? "Stop & Process" : "Tap to speak"}
              </span>
            </div>

            {/* Switch to Type Button */}
            <button 
              onClick={() => setMode("type")}
              className="flex flex-col items-center group"
            >
              <div className="w-14 h-14 rounded-full border-2 border-slate-300 bg-white flex items-center justify-center text-slate-600 shadow-sm group-hover:scale-105 group-hover:border-slate-400 transition-all">
                <Keyboard className="w-6 h-6 stroke-[1.8]" />
              </div>
              <span className="text-xs font-semibold text-slate-600 mt-1.5">
                Type
              </span>
            </button>
          </div>

          {/* Microcopy disclaimer */}
          <p className="text-[11px] text-slate-400 text-center leading-tight mb-2">
            Mic is on only while you tap. Audio is not stored by CivicFix.
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
                    <span>Registering Complaint...</span>
                  </>
                ) : (
                  <>
                    <span>Submit & View Breakdown (Page 2)</span>
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
              <label className="p-2 text-slate-500 hover:text-slate-800 cursor-pointer rounded-xl hover:bg-slate-200/60 transition-colors">
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handlePhotoUpload} 
                />
                <Camera className="w-5 h-5" />
              </label>

              {/* Text Input */}
              <input 
                type="text" 
                placeholder={lang === "en" ? "Type your message in Urdu or English..." : "اپنا پیغام یہاں لکھیں..."}
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
                title="Switch to Voice Mic"
              >
                <Mic className="w-5 h-5" />
              </button>

              {/* Send Button */}
              <button 
                onClick={handleSendTextMessage}
                disabled={!textInput.trim()}
                className="bg-[#0D5C63] hover:bg-[#09484E] disabled:opacity-40 text-white p-2.5 rounded-xl transition-all shadow-sm shrink-0"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Submit to Page 2 CTA */}
            {onNavigateToReceived && (
              <div className="flex items-center justify-between text-xs pt-1">
                <span className="text-[11px] text-slate-400">
                  Press Enter to send message
                </span>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="text-xs text-[#0D5C63] hover:text-[#09484E] font-bold inline-flex items-center gap-1 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl border border-teal-200 transition-all shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Complaint</span>
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
                  <span>Submitting Complaint to Department...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-teal-300" />
                  <span>Submit Form & View Urgency Breakdown (Page 2)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span>Prefer speaking?</span>
              <button
                type="button"
                onClick={() => setMode("talk")}
                className="text-[#0D5C63] font-bold hover:underline flex items-center gap-1"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Switch to Voice Mic</span>
              </button>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
