"use client";
/**
 * Die Spiele zu den Stellenwerten: Bit-Fall (Zeilen stapeln sich, Bits
 * schalten oder ablesen), Hex-Farbmischer (#RRGGBB nachmischen),
 * Zählwerk-Rennen (Übertrag vorhersagen) und Geheimbotschaft (ASCII-Bytes).
 */
import { useState } from "react";
import { Chips } from "@/components/prozent/ui";
import BitFall from "./spiele/BitFall";
import Farbmischer from "./spiele/Farbmischer";
import ZaehlwerkRennen from "./spiele/ZaehlwerkRennen";
import Geheimbotschaft from "./spiele/Geheimbotschaft";
import type { StellenwertZugang } from "./Stellenwert";

const SPIELE = [
  { id: "bitfall", label: "🧱 Bit-Fall" },
  { id: "farbe", label: "🎨 Hex-Farbmischer" },
  { id: "zaehlwerk", label: "🚗 Zählwerk-Rennen" },
  { id: "geheim", label: "🕵️ Geheimbotschaft" },
] as const;
type Id = (typeof SPIELE)[number]["id"];

export default function Spiele({ zugang }: { zugang?: StellenwertZugang }) {
  const [spiel, setSpiel] = useState<Id>("bitfall");
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={spiel} setze={setSpiel} optionen={SPIELE} />
      <div className="card p-4 sm:p-5">
        {spiel === "bitfall" && <BitFall />}
        {spiel === "farbe" && <Farbmischer />}
        {spiel === "zaehlwerk" && <ZaehlwerkRennen />}
        {spiel === "geheim" && <Geheimbotschaft zugang={zugang} />}
      </div>
    </div>
  );
}
