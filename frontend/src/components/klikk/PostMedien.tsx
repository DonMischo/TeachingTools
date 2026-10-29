"use client";
/** Was ein Klikk-Beitrag zeigt: Foto, PC-Teile, 3D-Clip, Meme, Nachricht oder Umfrage. */
import { lazy, Suspense, useState } from "react";
import { galerieBild } from "@/lib/sonnensystem/bilder";
import vulkanBilder from "@/lib/vulkan/bilder.json";
import { PcbDefs, Zeichnung } from "@/components/pcbau/zeichnungen";
import type { Medien } from "@/lib/klikk/posts";

const Clip3D = lazy(() => import("./Clip3D"));

type Nachweis = { datei: string; lizenz: string; urheber: string };
const VULKAN = vulkanBilder as Record<string, Nachweis>;

export function nachweis(m: Extract<Medien, { art: "foto" }>): Nachweis | undefined {
  return m.quelle === "weltall" ? galerieBild(m.id) : VULKAN[m.id];
}

/** Bildfläche des Beitrags (ohne Text darunter). `ersatz` ist das Emoji, wenn nichts geladen werden kann. */
export default function PostMedien({ medien, ersatz, antwort, antworten }: {
  medien: Medien; ersatz: string;
  /** Umfrage: gewählte Option (dann Ergebnis zeigen) */
  antwort?: string;
  antworten?: (option: string) => void;
}) {
  if (medien.art === "foto") return <Foto medien={medien} ersatz={ersatz} />;
  return <Rest medien={medien} ersatz={ersatz} antwort={antwort} antworten={antworten} />;
}

/** Foto mit Nachweis; in der Offline-Datei gibt es die Bilder nicht — dann bleibt das Emoji. */
function Foto({ medien, ersatz }: { medien: Extract<Medien, { art: "foto" }>; ersatz: string }) {
  const [kaputt, setKaputt] = useState(false);
  const n = nachweis(medien);
  if (!n || kaputt) return <div className="w-full h-full grid place-items-center text-8xl bg-gradient-to-b from-indigo-900 to-black">{ersatz || "🌌"}</div>;
  return (
      <div className="w-full h-full relative bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={n.datei} alt="" className="w-full h-full object-cover" onError={() => setKaputt(true)} />
        <span className="absolute bottom-1 left-1 right-1 text-[9px] text-white/80 bg-black/40 rounded px-1 truncate">
          Foto: {n.urheber} · {n.lizenz} · Wikimedia Commons
        </span>
      </div>
  );
}

function Rest({ medien, ersatz, antwort, antworten }: {
  medien: Exclude<Medien, { art: "foto" }>; ersatz: string; antwort?: string; antworten?: (option: string) => void;
}) {

  if (medien.art === "pc") {
    const n = medien.teile.length;
    return (
      <div className="w-full h-full grid place-items-center p-4" style={{ background: "#0b1020", animation: medien.rgb ? "klikkRgb 4s linear infinite" : undefined }}>
        {medien.rgb && <style>{"@keyframes klikkRgb { from { filter: hue-rotate(0deg) saturate(1.4) } to { filter: hue-rotate(360deg) saturate(1.4) } }"}</style>}
        <svg viewBox="0 0 240 320" className="w-full h-full" role="img" aria-label="PC-Teile">
          <PcbDefs />
          {medien.teile.map((t, i) => {
            const zeilen = n > 2 ? 2 : 1, spalten = Math.ceil(n / zeilen);
            const w = 220 / spalten, h = 300 / zeilen;
            const x = 10 + (i % spalten) * w, y = 10 + Math.floor(i / spalten) * h;
            return <g key={t} transform={`translate(${x + 4},${y + 4})`}><Zeichnung name={t} w={w - 8} h={h - 8} an /></g>;
          })}
        </svg>
      </div>
    );
  }

  if (medien.art === "clip") {
    return (
      <Suspense fallback={<div className="w-full h-full grid place-items-center text-8xl animate-pulse">{ersatz}</div>}>
        <Clip3D clip={medien.clip} ersatz={ersatz} />
      </Suspense>
    );
  }

  if (medien.art === "meme") {
    const stil = "font-black uppercase text-white text-center text-xl leading-tight px-3 [text-shadow:_2px_2px_0_#000,-2px_-2px_0_#000,2px_-2px_0_#000,-2px_2px_0_#000]";
    return (
      <div className="w-full h-full flex flex-col justify-between py-4 bg-gradient-to-b from-zinc-700 to-zinc-900">
        <div className={stil}>{medien.oben}</div>
        <div className="text-7xl text-center select-none">{ersatz || "😐"}</div>
        <div className={stil}>{medien.unten}</div>
      </div>
    );
  }

  if (medien.art === "news") {
    return (
      <div className="w-full h-full flex flex-col bg-white text-zinc-900">
        <div className={`px-3 py-2 text-xs font-black text-white ${medien.eilmeldung ? "bg-red-600" : "bg-zinc-900"}`}>
          {medien.eilmeldung ? "⚠️ EILMELDUNG · " : ""}{medien.quelle}
        </div>
        <div className="p-4 flex flex-col gap-2 flex-1 justify-center">
          <div className="text-2xl font-black leading-tight">{medien.schlagzeile}</div>
          <div className="text-sm text-zinc-600">{medien.unterzeile}</div>
        </div>
      </div>
    );
  }

  // Umfrage: das »Ergebnis« ist erfunden, die eigene Antwort nicht
  const gesamt = medien.optionen.length;
  return (
    <div className="w-full h-full flex flex-col justify-center gap-2 p-5 bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white">
      <div className="text-lg font-black mb-2">📊 {medien.frage}</div>
      {medien.optionen.map((o, i) => {
        const anteil = Math.round(100 * (gesamt - i) / ((gesamt * (gesamt + 1)) / 2));
        return antwort ? (
          <div key={o} className="relative rounded-xl bg-white/20 overflow-hidden px-3 py-2 text-sm font-bold">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: `${anteil}%` }} />
            <span className="relative">{o}{o === antwort ? " ✓" : ""}</span>
            <span className="relative float-right">{anteil} %</span>
          </div>
        ) : (
          <button key={o} onClick={() => antworten?.(o)} className="rounded-xl bg-white/90 text-zinc-900 px-3 py-2 text-sm font-bold text-left hover:bg-white">{o}</button>
        );
      })}
      <div className="text-[10px] opacity-80 mt-1">anonym · 12.481 Stimmen</div>
    </div>
  );
}
