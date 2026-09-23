"use client";
import Image from "next/image";
import { useTheme } from "@/contexts/ThemeContext";

/* ── Cyberpunk logo ─────────────────────────────────────────────────────── */
function CyberpunkLogo() {
  return (
    <svg viewBox="0 0 160 56" width="120" height="42" xmlns="http://www.w3.org/2000/svg" aria-label="TT - Teaching Tools – Cyberpunk">
      {/* Circuit grid background */}
      <rect width="160" height="56" fill="#070b14" rx="4"/>
      <line x1="0" y1="14" x2="160" y2="14" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      <line x1="0" y1="28" x2="160" y2="28" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      <line x1="0" y1="42" x2="160" y2="42" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      <line x1="40" y1="0" x2="40" y2="56" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      <line x1="80" y1="0" x2="80" y2="56" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      <line x1="120" y1="0" x2="120" y2="56" stroke="#00ffff" strokeWidth=".4" opacity=".2"/>
      {/* Corner circuit dots */}
      <circle cx="8" cy="8" r="2.5" fill="#00ffff" opacity=".7"/>
      <circle cx="152" cy="8" r="2.5" fill="#00ffff" opacity=".7"/>
      <circle cx="8" cy="48" r="2.5" fill="#00ffff" opacity=".7"/>
      <circle cx="152" cy="48" r="2.5" fill="#00ffff" opacity=".7"/>
      <line x1="10" y1="8" x2="24" y2="8" stroke="#00ffff" strokeWidth="1" opacity=".5"/>
      <line x1="8" y1="10" x2="8" y2="20" stroke="#00ffff" strokeWidth="1" opacity=".5"/>
      <line x1="136" y1="48" x2="150" y2="48" stroke="#00ffff" strokeWidth="1" opacity=".5"/>
      <line x1="152" y1="36" x2="152" y2="46" stroke="#00ffff" strokeWidth="1" opacity=".5"/>
      {/* Main text */}
      <text x="80" y="22" textAnchor="middle" fill="#00ffff"
        fontFamily="'Courier New', monospace" fontSize="15" fontWeight="bold" letterSpacing="6"
        style={{ filter: "drop-shadow(0 0 4px #00ffff)" }}>
        TT
      </text>
      <text x="80" y="40" textAnchor="middle" fill="#00ffff"
        fontFamily="'Courier New', monospace" fontSize="9" fontWeight="bold" letterSpacing="2"
        opacity=".85">
        TEACHING TOOLS
      </text>
      {/* Accent bar */}
      <rect x="30" y="26" width="100" height="1" fill="#00ffff" opacity=".4"/>
      <polygon points="28,25 34,28.5 28,32" fill="#00ffff" opacity=".6"/>
      <polygon points="132,25 126,28.5 132,32" fill="#00ffff" opacity=".6"/>
    </svg>
  );
}

/* ── Fantasy logo ───────────────────────────────────────────────────────── */
function FantasyLogo() {
  return (
    <svg viewBox="0 0 160 56" width="120" height="42" xmlns="http://www.w3.org/2000/svg" aria-label="TT - Teaching Tools – Fantasy">
      {/* Parchment-dark background */}
      <rect width="160" height="56" fill="#120c1c" rx="4"/>
      {/* Stars */}
      <circle cx="12" cy="10" r="1.2" fill="#c8a040" opacity=".8"/>
      <circle cx="148" cy="10" r="1.2" fill="#c8a040" opacity=".8"/>
      <circle cx="20" cy="44" r=".9" fill="#c8a040" opacity=".5"/>
      <circle cx="140" cy="44" r=".9" fill="#c8a040" opacity=".5"/>
      <circle cx="6" cy="28" r=".8" fill="#c8a040" opacity=".4"/>
      <circle cx="154" cy="28" r=".8" fill="#c8a040" opacity=".4"/>
      {/* Castle silhouette */}
      <g opacity=".35" fill="#c8a040">
        <rect x="8" y="18" width="6" height="14"/>
        <rect x="7" y="15" width="2" height="4"/>
        <rect x="11" y="15" width="2" height="4"/>
        <rect x="9" y="26" width="2" height="4"/>
        <rect x="146" y="18" width="6" height="14"/>
        <rect x="145" y="15" width="2" height="4"/>
        <rect x="149" y="15" width="2" height="4"/>
        <rect x="147" y="26" width="2" height="4"/>
      </g>
      {/* Decorative top bar */}
      <path d="M22 14 Q80 8 138 14" fill="none" stroke="#c8a040" strokeWidth=".8" opacity=".5"/>
      {/* Ornamental diamonds */}
      <polygon points="80,9 82,12 80,15 78,12" fill="#c8a040" opacity=".7"/>
      <polygon points="50,11 51.5,13.5 50,16 48.5,13.5" fill="#c8a040" opacity=".4"/>
      <polygon points="110,11 111.5,13.5 110,16 108.5,13.5" fill="#c8a040" opacity=".4"/>
      {/* Main text */}
      <text x="80" y="30" textAnchor="middle" fill="#c8a040"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="16" fontWeight="bold" letterSpacing="6">
        TT
      </text>
      {/* Subtitle */}
      <text x="80" y="44" textAnchor="middle" fill="#c8a040"
        fontFamily="Georgia, 'Times New Roman', serif" fontSize="7" letterSpacing="2" opacity=".65">
        ✦  TEACHING TOOLS  ✦
      </text>
      {/* Bottom ornament */}
      <path d="M32 47 Q80 50 128 47" fill="none" stroke="#c8a040" strokeWidth=".8" opacity=".4"/>
    </svg>
  );
}

/* ── Default text logo ──────────────────────────────────────────────────── */
function DefaultLogo() {
  return (
    <div title="TT - Teaching Tools" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "4px 0" }}>
      <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1, color: "var(--accent)", lineHeight: 1 }}>TT</span>
    </div>
  );
}

export function AppLogo() {
  const { colorTheme, style } = useTheme();

  // Custom logo from style pack takes precedence over everything
  if (style.logo) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={style.logo} alt="Logo" style={{ width: 40, height: 40, objectFit: "contain" }} />
    );
  }

  if (colorTheme === "cyberpunk") return <CyberpunkLogo />;
  if (colorTheme === "fantasy")   return <FantasyLogo />;
  if (colorTheme === "ege") {
    return (
      <Image src="/EGE_logo.png" alt="EGE Logo" width={52} height={52}
        style={{ objectFit: "contain", borderRadius: 4 }} priority unoptimized />
    );
  }
  return <DefaultLogo />;
}
