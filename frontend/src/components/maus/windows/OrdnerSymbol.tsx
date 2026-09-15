"use client";
/** Ordner- und Laufwerkssymbole im Stil von Windows 11 — selbst gezeichnet. */
import type { Knoten, OrdnerArt } from "@/lib/maus/dateisystem";

function Aufdruck({ art }: { art: OrdnerArt }) {
  switch (art) {
    case "desktop":
      return <rect x="17" y="24" width="14" height="9" rx="1.5" fill="#3b82f6" />;
    case "dokumente":
      return <path d="M19 21h8l3 3v10H19z" fill="#fff" stroke="#94a3b8" strokeWidth="1" />;
    case "downloads":
      return <path d="M24 20v10m-5-4l5 5 5-5" fill="none" stroke="#16a34a" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />;
    case "bilder":
      return (
        <>
          <rect x="17" y="22" width="14" height="11" rx="1.5" fill="#fff" />
          <path d="M18 32l4-5 3 3 2-2 3 4z" fill="#0ea5e9" />
        </>
      );
    case "musik":
      return <path d="M22 32a2.5 2.5 0 1 1-1-2V21l8-2v9a2.5 2.5 0 1 1-1-2v-5l-6 1.5z" fill="#e11d48" />;
    case "videos":
      return <path d="M20 22l10 5.5-10 5.5z" fill="#7c3aed" />;
    case "benutzer":
      return (
        <>
          <circle cx="24" cy="24" r="3.5" fill="#475569" />
          <path d="M17.5 34c1-4 3.5-6 6.5-6s5.5 2 6.5 6z" fill="#475569" />
        </>
      );
    case "system":
      return <path d="M24 20l6 2v5c0 4-3 6-6 7-3-1-6-3-6-7v-5z" fill="#64748b" />;
    default:
      return null;
  }
}

export function OrdnerSymbol({ knoten, groesse = 40 }: { knoten: Pick<Knoten, "art" | "ordnerArt">; groesse?: number | string }) {
  if (knoten.art === "laufwerk") {
    return (
      <svg viewBox="0 0 48 48" width={groesse} height={groesse} aria-hidden>
        <rect x="5" y="16" width="38" height="18" rx="3" fill="#cbd5e1" stroke="#64748b" strokeWidth="1.5" />
        <rect x="9" y="20" width="4" height="4" fill="#0078d7" />
        <rect x="14" y="20" width="4" height="4" fill="#0078d7" />
        <rect x="9" y="25" width="4" height="4" fill="#0078d7" />
        <rect x="14" y="25" width="4" height="4" fill="#0078d7" />
        <circle cx="37" cy="29" r="1.6" fill="#22c55e" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={groesse} height={groesse} aria-hidden>
      <path d="M4 12a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v22a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#e0a800" />
      <path d="M4 18h40v20a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3z" fill="#f7d774" />
      <Aufdruck art={knoten.ordnerArt ?? "normal"} />
    </svg>
  );
}
