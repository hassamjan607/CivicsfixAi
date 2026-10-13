import React from "react";

interface DemoPhrasesProps {
  onSelectPhrase?: (phrase: string) => void;
}

export function DemoPhrases({ onSelectPhrase }: DemoPhrasesProps) {
  const phrases = [
    "Hamari gali mein gutter ubal raha hai.",
    "Road per bohot bara pothole hai.",
    "Streetlight 3 din se band hai.",
    "Kachra pichle hafte se uthaya nahi gaya."
  ];

  return (
    <div className="space-y-2">
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
        Suggested phrases:
      </span>
      <div className="flex flex-wrap gap-2">
        {phrases.map((phrase, i) => (
          <button
            key={i}
            onClick={() => onSelectPhrase && onSelectPhrase(phrase)}
            className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl transition-colors font-medium text-left"
          >
            &quot;{phrase}&quot;
          </button>
        ))}
      </div>
    </div>
  );
}
