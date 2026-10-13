import React from "react";

interface VoiceButtonProps {
  isListening?: boolean;
  onClick?: () => void;
  className?: string;
}

export function VoiceButton({ isListening = false, onClick, className = "" }: VoiceButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-14 h-14 rounded-full flex items-center justify-center text-white transition-all shadow-lg ${
        isListening ? "bg-red-600 animate-pulse" : "bg-[#0D5C63] hover:bg-[#0A4D54]"
      } ${className}`}
      aria-label="Voice input"
    >
      <span className="text-xl">🎙️</span>
    </button>
  );
}
