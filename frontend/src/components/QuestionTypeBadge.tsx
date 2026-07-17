// Icons and labels for each quiz question type.

type QuestionType = "single" | "multi" | "true_false" | "survey" | "sort" | "umrechnung" | "timeline";

const CONFIG: Record<QuestionType, { label: string; icon: React.ReactNode; color: string }> = {
  single: {
    label: "Eine Antwort",
    color: "#1368ce",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none" />
        <circle cx="10" cy="10" r="4" />
      </svg>
    ),
  },
  multi: {
    label: "Mehrere Antworten",
    color: "#26890c",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
        <polyline points="3.5,5.5 5,7.5 8,3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
        <polyline points="12.5,14.5 14,16.5 17,12.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="2" fill="none" />
      </svg>
    ),
  },
  true_false: {
    label: "Wahr oder Falsch",
    color: "#d89e00",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-full h-full">
        <polyline points="3,11 7,15 11,7" stroke="#26890c" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="13" y1="7" x2="19" y2="13" stroke="#e21b3c" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="19" y1="7" x2="13" y2="13" stroke="#e21b3c" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    ),
  },
  survey: {
    label: "Umfrage",
    color: "#7c3aed",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
        <rect x="2" y="14" width="3" height="4" rx="1" />
        <rect x="7" y="9" width="3" height="9" rx="1" />
        <rect x="12" y="5" width="3" height="13" rx="1" />
        <rect x="17" y="2" width="3" height="16" rx="1" />
      </svg>
    ),
  },
  sort: {
    label: "Sortieren",
    color: "#ea580c",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
        <line x1="4" y1="5" x2="16" y2="5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="10" x2="12" y2="10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="4" y1="15" x2="8" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  timeline: {
    label: "Zeitstrahl",
    color: "#db2777",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-full h-full">
        <line x1="2" y1="13" x2="18" y2="13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <line x1="5" y1="11" x2="5" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="10" y1="11" x2="10" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="15" y1="11" x2="15" y2="15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="7.5" cy="6" r="2.2" />
        <path d="M7.5 8.2V13" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    ),
  },
  umrechnung: {
    label: "Umrechnung",
    color: "#0891b2",
    icon: (
      <svg viewBox="0 0 20 20" fill="none" className="w-full h-full">
        <text x="1" y="14" fontSize="10" fontWeight="bold" fill="currentColor">123</text>
        <path d="M14 4l3 3-3 3M17 7H12M6 16l-3-3 3-3M3 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
};

export function QuestionTypeBadge({
  type,
  size = "md",
}: {
  type: string;
  size?: "sm" | "md" | "lg";
}) {
  const cfg = CONFIG[type as QuestionType] ?? CONFIG.single;
  const iconSize = size === "sm" ? "w-4 h-4" : size === "lg" ? "w-7 h-7" : "w-5 h-5";
  const textSize = size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
  const px = size === "sm" ? "px-2 py-0.5 gap-1" : size === "lg" ? "px-4 py-2 gap-2" : "px-3 py-1 gap-1.5";

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold ${px} ${textSize}`}
      style={{ backgroundColor: `${cfg.color}22`, color: cfg.color, border: `1.5px solid ${cfg.color}55` }}
    >
      <span className={iconSize} style={{ color: cfg.color }}>{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}
