"use client";
/**
 * »Paket im Paket«: die Kapselung als ineinander gesteckte Umschläge.
 * Außen die tiefste Schicht, die gerade dran ist, innen die Daten.
 * Einsteiger sehen Alltagswörter (Umschlag, Puzzleteil, Geheimcode),
 * sonst stehen die Fachbegriffe und echten Werte da.
 */
import { schicht, type SchichtNr } from "@/lib/schichten/kapselung";
import { ADRESSEN, KNOTEN } from "@/lib/schichten/route";
import type { Niveau } from "./Bausteine";

interface Beschriftung { kopf: string; fuss?: string }

function beschriftung(nr: SchichtNr, einfach: boolean, foto: boolean, segmente: number, seg: number, seq: number): Beschriftung {
  if (einfach) {
    switch (nr) {
      case 7: return { kopf: foto ? "🐈 Das Foto · mit Zettel: »Bitte speichern«" : "✏️ Die Nachricht · mit Zettel: »Bitte speichern«" };
      case 6: return { kopf: "🔒 Geheimcode — nur Lena und der Server können ihn lesen" };
      case 5: return { kopf: "🤝 Verabredetes Gespräch zwischen Handy und Server" };
      case 4: return { kopf: `🧩 Puzzleteil Nr. ${seg} von ${segmente} · für das Foto-Programm` };
      case 3: return { kopf: "✉️ Umschlag: An den Server in Tokio · Von Lena" };
      case 2: return { kopf: "🚚 Nur bis zum WLAN-Router in der Wohnung", fuss: "✔️ Prüfzahl: Ist unterwegs etwas kaputtgegangen?" };
      default: return { kopf: "〰️ Funkwellen: 0 1 0 0 1 1 0 1 …" };
    }
  }
  switch (nr) {
    case 7: return { kopf: `HTTP: POST /v1/fotos · ${foto ? "JPEG" : "Text (UTF-8)"}` };
    case 6: return { kopf: "TLS-Datensatz · ChaCha20-Poly1305 · 5 Byte Kopf + 16 Byte Siegel" };
    case 5: return { kopf: "Sitzung (TLS) — im Internet ohne eigenen Kopf" };
    case 4: return { kopf: `TCP · Port ${ADRESSEN.handyPort} → 443 · Seq ${seq} · Segment ${seg}/${segmente}` };
    case 3: return { kopf: `IPv4 · ${ADRESSEN.handy} → ${ADRESSEN.server} · TTL 64` };
    case 2: return { kopf: `Ethernet · ${KNOTEN[0].mac} → ${KNOTEN[1].mac}`, fuss: "FCS (CRC-32)" };
    default: return { kopf: "Präambel 55 55 55 55 55 55 55 D5 · Bits" };
  }
}

export default function Schachtel({ tiefste, niveau, foto, segmente, seg, seq }: {
  /** unterste Schicht, deren Hülle gerade drum ist (1 = alles bis zu den Bits) */
  tiefste: SchichtNr;
  niveau: Niveau;
  foto: boolean;
  segmente: number;
  seg: number;
  seq: number;
}) {
  const einfach = niveau === "einsteiger";
  const reihe = ([1, 2, 3, 4, 5, 6, 7] as SchichtNr[]).filter(n => n >= tiefste);

  const huelle = (i: number): React.ReactNode => {
    const nr = reihe[i];
    const s = schicht(nr);
    const b = beschriftung(nr, einfach, foto, segmente, seg, seq);
    const innen = i + 1 < reihe.length ? huelle(i + 1) : null;
    const gestrichelt = nr === 5;
    return (
      <div className={`rounded-xl border-2 p-2 sm:p-3 flex flex-col gap-2 ${nr === 1 ? "bg-[repeating-linear-gradient(90deg,transparent_0_6px,rgba(6,182,212,0.12)_6px_8px)]" : ""}`}
        style={{ borderColor: s.farbe, borderStyle: gestrichelt ? "dashed" : "solid", background: nr === 7 ? `${s.farbe}22` : undefined }}>
        <div className="text-xs sm:text-sm font-semibold leading-snug" style={{ color: s.farbe }}>
          <span className="inline-block rounded px-1.5 mr-1.5 text-white text-[10px] align-middle" style={{ background: s.farbe }}>{nr}</span>
          {b.kopf}
        </div>
        {innen}
        {b.fuss && <div className="text-xs font-semibold self-end" style={{ color: s.farbe }}>{b.fuss}</div>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      <span className="label">{einfach ? "📦 So sieht das Paket gerade aus" : "📦 Kapselung in diesem Schritt"}</span>
      {huelle(0)}
    </div>
  );
}
