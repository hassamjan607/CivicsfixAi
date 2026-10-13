import React from "react";

interface EmergencyBannerProps {
  show?: boolean;
  message?: string;
  onDismiss?: () => void;
}

export function EmergencyBanner({ 
  show = false, 
  message = "Emergency Detected: Urgency set to 10 immediately.",
  onDismiss 
}: EmergencyBannerProps) {
  if (!show) return null;

  return (
    <div className="bg-red-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between border border-red-700 animate-pulse">
      <div className="flex items-center space-x-2.5">
        <span className="text-xl">⚠️</span>
        <span className="text-sm font-bold">{message}</span>
      </div>
      {onDismiss && (
        <button 
          onClick={onDismiss} 
          className="text-white/80 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg hover:bg-white/10"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
