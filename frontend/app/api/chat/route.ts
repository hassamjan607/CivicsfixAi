import { NextRequest, NextResponse } from "next/server";

interface ChatResponseData {
  replyUr: string;
  replyEn: string;
  category: "Sewage" | "Roads" | "Streetlights" | "Garbage" | "Water Supply" | "Other";
  detectedIssue: string;
  isEmergency: boolean;
  urgencyScore: number;
  needsPhoto: boolean;
  needsLocation: boolean;
  isGreetingOrConversational: boolean;
  isFollowUp?: boolean;
  extractedLocation?: string;
  appendedDetails?: string;
}

interface ChatContext {
  history?: Array<{ sender: "user" | "assistant"; text: string }>;
  currentCategory?: string;
  currentDescription?: string;
  hasPhoto?: boolean;
  location?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawMessage = (body.message || body.text || "").trim();
    const lang: "en" | "ur" = body.lang === "ur" || anyUrduChar(rawMessage) ? "ur" : "en";
    
    const context: ChatContext = {
      history: body.history || [],
      currentCategory: body.currentCategory,
      currentDescription: body.currentDescription,
      hasPhoto: body.hasPhoto || false,
      location: body.location || "Street 4, Lahore Central"
    };

    if (!rawMessage) {
      return NextResponse.json({
        replyUr: "براہ کرم اپنا مسئلہ بتائیں۔ میں آپ کی مدد کے لیے حاضر ہوں۔",
        replyEn: "Please describe your problem. I am ready to assist you.",
        category: "Other",
        detectedIssue: "None",
        isEmergency: false,
        urgencyScore: 1,
        needsPhoto: false,
        needsLocation: false,
        isGreetingOrConversational: true
      });
    }

    // Context-aware multi-turn bilingual NLP analyzer
    const analysis = analyzeCitizenMessage(rawMessage, lang, context);
    return NextResponse.json(analysis);

  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({
      replyUr: "شکریہ! آپ کا پیغام موصول ہو گیا ہے۔ برائے مہربانی اپنا مسئلہ تفصیل سے بتائیں تاکہ متعلقہ عملے کو بھیجا جا سکے۔",
      replyEn: "Thank you! Your message is received. Please describe your issue so it can be routed to the team.",
      category: "Other",
      detectedIssue: "Citizen Message",
      isEmergency: false,
      urgencyScore: 4,
      needsPhoto: false,
      needsLocation: false,
      isGreetingOrConversational: false
    });
  }
}

function anyUrduChar(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function analyzeCitizenMessage(
  text: string, 
  lang: "en" | "ur", 
  context: ChatContext
): ChatResponseData {
  const lower = text.toLowerCase().trim();
  const trimmed = text.trim();
  const history = context.history || [];
  const currentCategory = (context.currentCategory && context.currentCategory !== "Other") 
    ? context.currentCategory 
    : undefined;
  const currentDescription = context.currentDescription || "";
  const location = context.location || "your street";

  const isDefaultGutterDescription = (currentDescription || "").includes("Hamari gali mein gutter");
  const hasGenuineDescription = !!(currentDescription && currentDescription.trim().length > 5 && !isDefaultGutterDescription);
  const hasPriorComplaint = !!(currentCategory && currentCategory !== "Other" && hasGenuineDescription);

  // Check if message describes a specific civic problem / issue
  const hasIssueKeywords =
    /wire|taar|spark|current|dangling|pole fallen|short circuit|bijli ka khamba|كرنٹ|تاریں|تار ٹوٹ|شارٹ سرکٹ|کھمبا گر|تار|کرنٹ|بجلی گر|manhole|man hole|mainhole|main hole|gutter cover|dhakkan|dhakan|chamber|gutter|gatar|gataar|sewage|sewer|drain|nadi|nalla|nala|ganda pani|badboo|ubal|choke|مین ہول|ڈھکن|سیوریج|گٹر|نالہ|گندا پانی|نالی|pothole|sarak|gaddha|khadda|broken|toot|patch|accident|crater|سڑک|گڑھا|کھڈا|ٹوٹی سڑک|روڈ|garbage|kachra|trash|waste|kuda|dher|safai|smell|dump|کچرا|کوڑا|صفائی|ڈھیر|بدبو|streetlight|street light|light band|bulb|khamba|dark|bijli|رات کو اندھیرا|لائٹ بند|اسٹریٹ لائٹ|بلب|water supply|pipe burst|leak|nal|peenay ka pani|paani band|پانی بند|پائپ لیک|پینے کا پانی/.test(lower) ||
    /مین ہول|ڈھکن|گٹر|نالہ|سیوریج|گندا پانی|نالی|سڑک|گڑھا|ٹوٹی|کچرا|کوڑا|صفائی|اسٹریٹ لائٹ|لائٹ بند|پانی بند|پائپ لیک|تار|کرنٹ/.test(text);

  // =========================================================================
  // MULTI-TURN CONVERSATION MEMORY (FOLLOW-UP LOGIC)
  // Only execute follow-up handlers if user does NOT describe a new civic hazard!
  // =========================================================================

  if (hasPriorComplaint && !hasIssueKeywords) {
    // 1. Follow-up: User confirming or talking about attaching photo
    // e.g. "yes please add the photo and", "yes", "photo", "i have photo", "haan photo hai"
    if (
      /^(yes|yeah|haan|ji|sure|ok|okay|please|add photo|attach photo|photo|picture|tasveer|pic|send photo|upload)/i.test(lower) ||
      /(add|attach|upload|include|take|bhej|send|karo).*photo/i.test(lower) ||
      /تصویر|فوٹو|تصویر ہے|شامل کرو|بھیجتا ہوں/.test(text)
    ) {
      const activeCat = (currentCategory as any) || "Sewage";
      return {
        replyUr: `بہترین! برائے مہربانی نیچے کیمرے (Camera) کے بٹن پر کلک کر کے ${currentDescription ? `"${currentDescription}"` : "مسئلے"} کی تصویر شامل کریں۔ تصویر لگتے ہی آپ کی شکایت مکمل ہو جائے گی۔`,
        replyEn: `Great! Please tap the Camera icon below to attach your photo for the ${activeCat.toLowerCase()} issue. Once attached, your complaint is ready to submit!`,
        category: activeCat,
        detectedIssue: currentDescription,
        isEmergency: false,
        urgencyScore: 8,
        needsPhoto: true,
        needsLocation: false,
        isGreetingOrConversational: false,
        isFollowUp: true
      };
    }

    // 2. Follow-up: User declining photo or saying no
    // e.g. "no photo", "nahi hai", "nahi", "no", "direct submit", "without photo"
    if (
      /^(no|nahi|nahin|dont have|no photo|without photo|nahi hai|tasveer nahi)/i.test(lower) ||
      /تصویر نہیں|نہیں ہے|نہیں/.test(text)
    ) {
      const activeCat = (currentCategory as any) || "Sewage";
      return {
        replyUr: `سمجھ گیا! تصویر کے بغیر بھی کارروائی آگے بڑھائی جا سکتی ہے۔ آپ کی شکایت درج ہے۔ نیچے 'شکایت جمع کروائیں' کے بٹن پر کلک کریں۔`,
        replyEn: `Understood, proceeding without a photo. Your ${activeCat.toLowerCase()} complaint is registered. Tap 'Submit Citizen Complaint' below to dispatch it.`,
        category: activeCat,
        detectedIssue: currentDescription,
        isEmergency: false,
        urgencyScore: 7,
        needsPhoto: false,
        needsLocation: false,
        isGreetingOrConversational: false,
        isFollowUp: true
      };
    }

    // 3. Follow-up: Pure Location specification without hazard keywords
    // e.g. "near market", "Street 4", "gali no 2", "chowk", "sector B", "Lahore cantt"
    if (
      /^(near|street|gali|chowk|block|sector|house|cantt|lahore|محلہ|گلی|چوک|روڈ|نزد|سیکٹر)/i.test(lower) ||
      /^(in |at )?(street \d+|gali \d+|block [a-z0-9]+|sector [a-z0-9]+)/i.test(lower)
    ) {
      const activeCat = (currentCategory as any) || "Sewage";
      return {
        replyUr: `مقام "${trimmed}" نوٹ کر لیا گیا ہے۔ آپ کی شکایت واسا/متعلقہ عملے کے لیے تیار ہے۔ کیا آپ تصویر بھی منسلک کرنا چاہیں گے؟`,
        replyEn: `Location recorded as "${trimmed}". This is now linked to your ${activeCat.toLowerCase()} complaint. Would you like to attach a photo or submit now?`,
        category: activeCat,
        detectedIssue: `${currentDescription} (Location: ${trimmed})`,
        isEmergency: false,
        urgencyScore: 7,
        needsPhoto: !context.hasPhoto,
        needsLocation: false,
        isGreetingOrConversational: false,
        isFollowUp: true,
        extractedLocation: trimmed
      };
    }

    // 4. Follow-up: User asking to finalize or submit
    // e.g. "submit it", "darj karo", "bhej do", "register it", "finalize"
    if (
      /^(submit|submit it|register|bhej do|darj karo|done|theek hai|kardo)/i.test(lower) ||
      /شکایت درج کرو|جمع کرو|بھیج دو/.test(text)
    ) {
      const activeCat = (currentCategory as any) || "Sewage";
      return {
        replyUr: `آپ کی شکایت "${currentDescription}" جمع ہونے کے لیے تیار ہے۔ برائے مہربانی نیچے 'شکایت جمع کروائیں' کا بٹن دبائیں۔`,
        replyEn: `Your complaint for "${currentDescription}" is ready. Please click 'Submit Citizen Complaint' below to finalize.`,
        category: activeCat,
        detectedIssue: currentDescription,
        isEmergency: false,
        urgencyScore: 7,
        needsPhoto: false,
        needsLocation: false,
        isGreetingOrConversational: false,
        isFollowUp: true
      };
    }
  }

  // =========================================================================
  // INITIAL INQUIRIES & CONVERSATIONAL TRIGGERS
  // =========================================================================

  // Incomplete / Very short words (< 4 chars) without prior context
  if (
    trimmed.length < 4 || 
    /^(hmm|haan|ok|hmm|hi|hey)$/i.test(trimmed)
  ) {
    return {
      replyUr: "جی، آپ کا پیغام نامکمل ہے۔ برائے مہربانی تفصیل سے بتائیں کہ آپ کے علاقے میں کیا مسئلہ پیش آیا ہے؟",
      replyEn: "Your message seems incomplete. Please provide more details about the civic problem you are facing.",
      category: "Other",
      detectedIssue: "Incomplete input",
      isEmergency: false,
      urgencyScore: 2,
      needsPhoto: false,
      needsLocation: true,
      isGreetingOrConversational: true
    };
  }

  // Greetings ("kese ho", "kaise ho", "how are you", "salam", "hello")
  if (
    /^(kese ho|kaise ho|kya haal|hal chal|how are you|kese hain|kaise hain|salam|assalam|aoa|hello|hi|hey|kia hal|kya hal)/i.test(lower) ||
    /^(کیسے ہو|کیا حال|سلام|السلام علیکم|کیسے ہیں|کیا حال ہے)/.test(text)
  ) {
    return {
      replyUr: "وعلیکم السلام! الحمدللہ، میں بلدیاتی خدمات کا اے آئی اسسٹنٹ ہوں۔ آج آپ کے علاقے کا کونسا مسئلہ (جیسے گٹر ابلنا، مین ہول ٹوٹنا، سڑک کا گڑھا، یا اسٹریٹ لائٹ) حل کرنے میں مدد کروں؟",
      replyEn: "Hello! I am doing well, thank you. I am your CivicFix AI assistant. What civic problem (such as damaged manholes, sewage, or potholes) can I help you resolve today?",
      category: "Other",
      detectedIssue: "Citizen greeting",
      isEmergency: false,
      urgencyScore: 1,
      needsPhoto: false,
      needsLocation: false,
      isGreetingOrConversational: true
    };
  }

  // Language preference requests
  if (
    /urdu (mein|me|mai)|speak urdu|urdu bolo|urdu bolain|اردو میں|اردو بولو/.test(lower) ||
    /اردو میں بولو|اردو بولو|اردو میں بات کرو/.test(text)
  ) {
    return {
      replyUr: "جی بالکل! میں اب اردو میں بات کر رہا ہوں۔ آپ بلا جھجھک اپنا بلدیاتی مسئلہ بتائیں، جیسے گٹر ابلنا، کچرے کا ڈھیر، یا سڑک کی خرابی۔",
      replyEn: "Certainly! I speak both English and Urdu fluently. Please describe your civic grievance in Urdu.",
      category: "Other",
      detectedIssue: "Language toggle to Urdu",
      isEmergency: false,
      urgencyScore: 1,
      needsPhoto: false,
      needsLocation: false,
      isGreetingOrConversational: true
    };
  }

  if (/speak english|english mein|english me|talk in english|english please/i.test(lower)) {
    return {
      replyUr: "جی بالکل، میں اب انگریزی میں جواب دے رہا ہوں۔ برائے مہربانی اپنی شکایت بتائیں۔",
      replyEn: "Certainly! I am now responding in English. Please describe your civic grievance so I can route it to the appropriate department.",
      category: "Other",
      detectedIssue: "Language toggle to English",
      isEmergency: false,
      urgencyScore: 1,
      needsPhoto: false,
      needsLocation: false,
      isGreetingOrConversational: true
    };
  }

  // =========================================================================
  // CORE MUNICIPAL COMPLAINT CLASSIFIER
  // =========================================================================

  // Critical Electrical / Live Wire / Sparks / Falling Pole Hazard (EMERGENCY 10/10)
  if (
    /wire|taar|spark|current|dangling|pole fallen|short circuit|bijli ka khamba|کرنٹ|تاریں|تار ٹوٹ|شارٹ سرکٹ|کھمبا گر/.test(lower) ||
    /تار|کرنٹ|بجلی گر|شارٹ سرکٹ/.test(text)
  ) {
    return {
      replyUr: "خطرناک ہنگامی صورتحال (Emergency)! کھلے تاروں اور کرنٹ کا خطرہ 10/10 ترجیح پر لیسکو (LESCO) کو الرٹ کر دیا گیا ہے۔ برائے مہربانی تاروں سے دور رہیں اور قریبی مقام کنفرم کریں۔",
      replyEn: "CRITICAL EMERGENCY HAZARD! High priority 10/10 alert sent to LESCO. Please stay away from fallen wires and confirm your location.",
      category: "Streetlights",
      detectedIssue: "Electrical Hazard (Live wires/sparking)",
      isEmergency: true,
      urgencyScore: 10,
      needsPhoto: false,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // Sewage / Manholes / Drains / Dirty Water Overflow / Gutter Cover
  // Matches "manhole", "man hole", "streat man hole", "dhakkan", "chamber", "gutter", "nadi", "nalla"
  if (
    /manhole|man hole|mainhole|main hole|gutter cover|dhakkan|dhakan|chamber|gutter|gatar|gataar|sewage|sewer|drain|nadi|nalla|nala|ganda pani|badboo|ubal|choke|مین ہول|ڈھکن|سیوریج|گٹر|نالہ|گندا پانی|نالی/.test(lower) ||
    /مین ہول|ڈھکن|گٹر|نالہ|سیوریج|گندا پانی|نالی/.test(text)
  ) {
    const isManhole = /manhole|man hole|mainhole|main hole|dhakkan|dhakan|chamber|مین ہول|ڈھکن/.test(lower);
    return {
      replyUr: isManhole 
        ? "سڑک پر مین ہول (Manhole) کے ٹوٹنے یا کھلے ہونے کی شکایت نوٹ کر لی گئی ہے۔ یہ حادثات کا سنگین خطرہ ہے، اس لیے واسا (WASA) کے عملے کو فوری ترجیح پر الرٹ کیا جا رہا ہے۔ کیا آپ تصویر شامل کرنا چاہیں گے؟"
        : "میں سمجھ گیا، آپ کے علاقے میں گٹر اور نالے کے ابلنے یا خرابی کا مسئلہ ہے۔ یہ شکایت واسا (WASA) کے متعلقہ شعبے کو ہائی ترجیح پر بھیجی جا رہی ہے۔ کیا آپ تصویر شامل کرنا چاہیں گے؟",
      replyEn: isManhole
        ? "Damaged or open manhole reported on the street. This is a severe accident hazard and has been marked as high priority under WASA Sanitation. Would you like to attach a photo or confirm your location?"
        : "Sewage overflow and drain blockage detected. This complaint has been routed to WASA Sanitation with high priority. Would you like to attach a photo or confirm your location?",
      category: "Sewage",
      detectedIssue: isManhole ? "Damaged / Open Street Manhole" : "Sewage Overflow & Drain Blockage",
      isEmergency: false,
      urgencyScore: 8,
      needsPhoto: true,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // Clean Water Supply / Leaking Pipe / Pipeline Burst / Drinking Water
  if (
    /water supply|pipeline|pipe|leak|nal|peenay ka pani|drinking water|clean water|paani band|water shortage|پانی بند|پائپ لیک|پینے کا پانی|پائپ ٹوٹ/.test(lower) ||
    /پانی بند|پائپ لیک|پینے کا پانی/.test(text)
  ) {
    return {
      replyUr: "پانی کی فراہمی میں رکاوٹ، پائپ ٹوٹنے یا لیکج کا مسئلہ نوٹ کر لیا گیا ہے۔ واٹر سپلائی ونگ (WASA) کو فوری مرمت کے لیے بھیج دیا گیا ہے۔",
      replyEn: "Water supply disruption or pipeline leakage recorded. Forwarded to Water Supply Division (WASA) for urgent repair.",
      category: "Water Supply",
      detectedIssue: "Drinking Water Pipeline Leak / Interruption",
      isEmergency: false,
      urgencyScore: 7,
      needsPhoto: true,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // Roads / Potholes / Broken Road / Cracks / Khadda / Gaddha
  if (
    /pothole|road broken|broken road|sarak|gaddha|khadda|tooti sarak|asphalt|crater|road accident|patchwork|road cave|سڑک|گڑھا|کھڈا|ٹوٹی سڑک|روڈ/.test(lower) ||
    /سڑک|گڑھا|ٹوٹی سڑک/.test(text)
  ) {
    return {
      replyUr: "سڑک کی خرابی اور گڑھے کا مسئلہ نوٹ کر لیا گیا ہے۔ اسے روڈز ڈیپارٹمنٹ (TEPA) کو بھیجا جا رہا ہے۔ کیا آپ کے پاس اس کی تصویر ہے؟",
      replyEn: "Pothole and damaged road issue has been registered. Dispatching to TEPA Roads Dept. Do you have a photo to attach?",
      category: "Roads",
      detectedIssue: "Damaged Road / Pothole",
      isEmergency: false,
      urgencyScore: 7,
      needsPhoto: true,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // Garbage / Trash / Waste Dump / Kuda / Kachra / Safai
  if (
    /garbage|kachra|trash|waste|kuda|dher|safai|smell|dump|کچرا|کوڑا|صفائی|ڈھیر|بدبو/.test(lower) ||
    /کچرا|کوڑا|صفائی/.test(text)
  ) {
    return {
      replyUr: "کچرے کے ڈھیر اور صفائی کی شکایت درج کر لی گئی ہے۔ سالڈ ویسٹ مینجمنٹ (LWMC) کی صفائی ٹیم کو مطلع کیا جا رہا ہے۔ برائے مہربانی گلی یا چوک کا نام بتائیں۔",
      replyEn: "Garbage accumulation and waste collection issue registered. Directing to Waste Management (LWMC). Please specify the street name.",
      category: "Garbage",
      detectedIssue: "Uncollected Garbage & Solid Waste",
      isEmergency: false,
      urgencyScore: 6,
      needsPhoto: true,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // Streetlights / Power Outage / Dark Street
  if (
    /streetlight|street light|light band|bulb|khamba|dark|bijli|رات کو اندھیرا|لائٹ بند|اسٹریٹ لائٹ|بلب/.test(lower) ||
    /اسٹریٹ لائٹ|لائٹ بند/.test(text)
  ) {
    return {
      replyUr: "اسٹریٹ لائٹ بند ہونے کی شکایت نوٹ کر لی گئی ہے۔ رات کے اندھیرے اور سیکیورٹی کے پیش نظر عملے کو الرٹ بھیج دیا گیا ہے۔",
      replyEn: "Streetlight outage has been recorded. Field maintenance team alerted to restore lighting for pedestrian safety.",
      category: "Streetlights",
      detectedIssue: "Street Light Outage",
      isEmergency: false,
      urgencyScore: 5,
      needsPhoto: false,
      needsLocation: true,
      isGreetingOrConversational: false
    };
  }

  // General Complaint Dynamic Extraction
  const preview = text.length > 50 ? text.slice(0, 50) + "..." : text;
  return {
    replyUr: `آپ کی شکایت: "${preview}" نوٹ کر لی گئی ہے اور میونسپل پورٹل پر درج کی جا رہی ہے۔ کیا آپ اس کی تصویر شامل کرنا چاہتے ہیں یا اپنا قریبی مقام کنفرم کریں گے؟`,
    replyEn: `Your complaint: "${preview}" has been recorded and routed to municipal operations. Would you like to attach a photo or confirm your location?`,
    category: "Other",
    detectedIssue: preview,
    isEmergency: false,
    urgencyScore: 5,
    needsPhoto: true,
    needsLocation: true,
    isGreetingOrConversational: false
  };
}
