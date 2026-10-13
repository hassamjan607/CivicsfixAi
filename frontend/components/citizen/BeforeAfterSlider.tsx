"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Sparkles, Eye, AlertCircle } from "lucide-react";

interface Props {
  className?: string;
  beforeTitle?: string;
  afterTitle?: string;
  beforePhotoUrl?: string | null;
  afterPhotoUrl?: string | null;
}

export default function BeforeAfterSlider({ 
  className = "",
  beforeTitle = "Before (Reported)",
  afterTitle = "After (Repaired)",
  beforePhotoUrl,
  afterPhotoUrl
}: Props) {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(Math.round(percentage));
  }, []);

  // Global mousemove and mouseup listeners while dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      window.addEventListener("touchmove", handleGlobalTouchMove);
      window.addEventListener("touchend", handleGlobalMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
      window.removeEventListener("touchend", handleGlobalMouseUp);
    };
  }, [isDragging, handleMove]);

  // Keyboard accessibility
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setSliderPosition(prev => Math.max(0, prev - 5));
    } else if (e.key === "ArrowRight") {
      setSliderPosition(prev => Math.min(100, prev + 5));
    }
  };

  return (
    <div className={`space-y-3 select-none w-full ${className}`}>
      {/* Captions Placed Above the Slider so Handle NEVER Overlaps Them */}
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="bg-[#0B1E36] text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>{beforeTitle}</span>
          </span>
          <span className="text-slate-400 text-xs font-bold">vs</span>
          <span className="bg-[#0D7377] text-white text-xs font-bold px-3 py-1 rounded-full shadow-xs flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-teal-300" />
            <span>{afterTitle}</span>
          </span>
        </div>

        {/* Quick Presets for Touch / One-Click */}
        <div className="flex items-center space-x-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => setSliderPosition(100)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              sliderPosition > 85 ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Before
          </button>
          <button
            type="button"
            onClick={() => setSliderPosition(50)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              sliderPosition >= 40 && sliderPosition <= 60 ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            50/50
          </button>
          <button
            type="button"
            onClick={() => setSliderPosition(0)}
            className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
              sliderPosition < 15 ? "bg-[#0D7377] text-white shadow-xs" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            After
          </button>
        </div>
      </div>

      {/* Main Image Slider Viewport */}
      <div
        ref={containerRef}
        tabIndex={0}
        role="slider"
        aria-label="Before and after photographic comparison slider"
        aria-valuenow={sliderPosition}
        aria-valuemin={0}
        aria-valuemax={100}
        onKeyDown={handleKeyDown}
        onMouseDown={(e) => {
          setIsDragging(true);
          handleMove(e.clientX);
        }}
        onTouchStart={(e) => {
          setIsDragging(true);
          if (e.touches[0]) handleMove(e.touches[0].clientX);
        }}
        className="relative h-64 sm:h-72 md:h-80 w-full rounded-2xl md:rounded-3xl overflow-hidden border border-slate-200 bg-slate-950 cursor-ew-resize shadow-md group focus:outline-none focus:ring-2 focus:ring-[#0D7377]"
      >
        {/* AFTER (Fixed / Clean) Layer - Background Full Width */}
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#E0F4F2]">
          {afterPhotoUrl ? (
            <img
              src={afterPhotoUrl}
              alt="After resolution photo"
              className="w-full h-full object-cover"
            />
          ) : (
            <>
              <div 
                className="absolute inset-0 opacity-80"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, #4FD1C5 0, #4FD1C5 18px, #E0F4F2 18px, #E0F4F2 36px)`
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-teal-950/40 via-transparent to-teal-900/10" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-teal-900 text-center p-4 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-[#0D7377] shadow-md mb-2">
                  <Sparkles className="w-6 h-6 stroke-[2]" />
                </div>
                <p className="font-bold text-sm tracking-tight text-teal-950">
                  Cleaned & Repaired Work Site
                </p>
                <p className="text-xs text-teal-800 max-w-[220px]">
                  Verified by Field Response Crew
                </p>
              </div>
            </>
          )}
        </div>

        {/* BEFORE Layer - Clipped width by Slider Position */}
        <div 
          className="absolute inset-0 bg-[#E2E8F0] overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          {beforePhotoUrl ? (
            <div 
              style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }} 
              className="h-full relative"
            >
              <img
                src={beforePhotoUrl}
                alt="Before hazard report photo"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div 
              style={{ width: containerRef.current ? `${containerRef.current.offsetWidth}px` : "100%" }}
              className="h-full relative"
            >
              <div 
                className="absolute inset-0 opacity-80"
                style={{
                  backgroundImage: `repeating-linear-gradient(45deg, #94A3B8 0, #94A3B8 18px, #F1F5F9 18px, #F1F5F9 36px)`
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-slate-900/10" />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-900 text-center p-4 pointer-events-none">
                <div className="w-12 h-12 rounded-full bg-slate-900/80 backdrop-blur-sm flex items-center justify-center text-amber-400 shadow-md mb-2">
                  <AlertCircle className="w-6 h-6 stroke-[2]" />
                </div>
                <p className="font-bold text-sm tracking-tight text-slate-900">
                  Original Reported Hazard
                </p>
                <p className="text-xs text-slate-700 max-w-[220px]">
                  Initial Citizen Photograph
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Draggable Divider Handle */}
        <div
          style={{ left: `${sliderPosition}%` }}
          className="absolute top-0 bottom-0 -ml-[2px] w-1 bg-white flex items-center justify-center z-20 cursor-ew-resize shadow-2xl"
        >
          <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white text-slate-800 shadow-2xl border-2 border-[#0D7377] flex items-center justify-center transition-transform ${
            isDragging ? "scale-110 shadow-teal-500/50" : "group-hover:scale-105"
          }`}>
            <span className="text-xs font-black tracking-tighter text-[#0D7377]">
              ◀ ▶
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400 font-medium px-1">
        <span className="flex items-center gap-1">
          <Eye className="w-3.5 h-3.5" />
          <span>Drag divider left or right to inspect work</span>
        </span>
        <span className="font-mono text-xs">{sliderPosition}% Before Visible</span>
      </div>
    </div>
  );
}
