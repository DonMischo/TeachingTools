"use client";
/** »In Klikk teilen« für Spielergebnisse: eigener Beitrag, mit Code auch im Klassen-Feed. */
import { useState } from "react";
import { api } from "@/lib/api";
import { NAME_MUSTER } from "@/lib/klikk/klasse";
import { spielTeilen } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import type { Online } from "./spiele/SpieleApp";

export default function TeilenKnopf({ s, setze, online, spiel, punkte, tipp }: {
  s: Stand; setze: (f: (s: Stand) => Stand) => void; online?: Online; spiel: string; punkte: number; tipp?: string;
}) {
  const [geteilt, setGeteilt] = useState(false);
  return (
    <button className="btn-secondary text-xs self-start disabled:opacity-60" disabled={geteilt} onClick={() => {
      setGeteilt(true);
      setze(st => spielTeilen(st, spiel, punkte, tipp));
      if (online?.zugang && NAME_MUSTER.test(s.name)) {
        api.klikk.posten(online.zugang, { name: s.name, art: "spiel", tag: s.tag, spiel, punkte, hygiene: s.hygiene }).catch(() => {});
      }
    }}>{geteilt ? "✅ Geteilt" : "📤 In Klikk teilen"}</button>
  );
}
