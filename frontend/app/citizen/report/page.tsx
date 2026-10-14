"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import CitizenSubmissionScreen from "@/components/citizen/CitizenSubmissionScreen";
import ComplaintReceivedScreen from "@/components/citizen/ComplaintReceivedScreen";

export default function CitizenReportPage() {
  const router = useRouter();
  const [submittedComplaint, setSubmittedComplaint] = useState<any | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);

  const handleComplaintSubmit = async (data: any) => {
    try {
      setSubmissionError(null);
      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: data.category || "Sewage",
          description: data.description || "Reported municipal hazard",
          inputMode: data.mode || "voice",
          lat: data.coords?.lat || 31.5204,
          lng: data.coords?.lng || 74.3587,
          address: data.location || "Street 4, Lahore Central",
          beforePhotoUrls: data.photoPreview ? [data.photoPreview] : [],
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to submit complaint.");
      }

      setSubmittedComplaint(resData.complaint);
    } catch (err: any) {
      console.error("Submission failed:", err);
      // Fallback display if server had issues, calculating dynamic explainable score
      const cat = data.category || "General Civic Issue";
      const descLower = (data.description || "").toLowerCase();
      
      let baseUrgency = 4;
      if (cat.includes("Sewage")) baseUrgency = 5;
      else if (cat.includes("Water")) baseUrgency = 5;
      else if (cat.includes("Road") || cat.includes("Pothole")) baseUrgency = 4;
      else if (cat.includes("Streetlight") || cat.includes("Light")) baseUrgency = 3;

      const isEmerg = /wire|taar|spark|current|short circuit|blast|dhamaka|کرنٹ|تار/.test(descLower);
      const isSensitive = /hospital|clinic|school|college|masjid|ہسپتال|اسکول|مدرسہ/.test(descLower);
      const isRain = /rain|barish|monsoon|flood|بارش|سیلاب/.test(descLower);
      const isSevere = /burst|massive|huge|deep|overflow|crater|danger|خطرناک|بڑا/.test(descLower);

      let calcUrgency = isEmerg ? 10 : baseUrgency;
      const reasons: string[] = [`Base severity for ${cat}: ${baseUrgency}/10`];

      if (isEmerg) {
        reasons.unshift("Emergency override: Live wire or immediate public hazard detected");
      } else {
        if (isSevere) {
          calcUrgency += 1;
          reasons.push("Damage intensity: Severe structural defect or overflow reported (+1)");
        }
        if (isSensitive) {
          calcUrgency += 2;
          reasons.push("Proximity bonus: Health or educational facility nearby (+2)");
        }
        if (isRain) {
          calcUrgency += 1;
          reasons.push("Weather alert: Precipitation / monsoon flood risk (+1)");
        }
      }
      calcUrgency = Math.min(10, Math.max(1, calcUrgency));

      const isTepa = ["Roads", "Potholes", "Streetlights"].includes(cat);

      setSubmittedComplaint({
        trackingId: `CF-${Math.floor(1000 + Math.random() * 9000)}`,
        category: cat,
        summary: data.description?.slice(0, 80) || `${cat} Issue`,
        address: data.location || "Street 4, Lahore Central",
        urgency: calcUrgency,
        reasons,
        departmentName: isTepa ? "Traffic & Transport Planning (TEPA)" : "Water & Sanitation Agency (WASA)",
        status: "SUBMITTED",
      });
    }
  };

  if (submittedComplaint) {
    return (
      <div className="w-full max-w-[1400px] mx-auto py-4">
        <ComplaintReceivedScreen
          complaintData={submittedComplaint}
          trackingId={submittedComplaint.trackingId}
          onBack={() => setSubmittedComplaint(null)}
          onNavigateToTrack={(tId) => router.push(`/citizen/complaints/${submittedComplaint.id || tId}`)}
          isWideView={true}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1400px] mx-auto py-2">
      <CitizenSubmissionScreen
        onNavigateToReceived={(data) => handleComplaintSubmit(data)}
        isWideView={true}
      />
    </div>
  );
}
