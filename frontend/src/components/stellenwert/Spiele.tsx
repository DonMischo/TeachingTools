"use client";
/**
 * Die Spiele zu den Stellenwerten: Bit-Fall (Zeilen stapeln sich, Bits
 * schalten oder ablesen), Zählwerk-Rennen (Übertrag vorhersagen) und Geheimbotschaft (ASCII-Bytes).
 */
import { useEffect, useState } from "react";
import { Chips } from "@/components/prozent/ui";
import BitFall from "./spiele/BitFall";
import ZaehlwerkRennen from "./spiele/ZaehlwerkRennen";
import Geheimbotschaft from "./spiele/Geheimbotschaft";
import type { Empfangen, Geheimpost } from "./spiele/Geheimpost";

const SPIELE = [
  { id: "bitfall", label: "🧱 Bit-Fall" },
  { id: "zaehlwerk", label: "🚗 Zählwerk-Rennen" },
  { id: "geheim", label: "🕵️ Geheimbotschaft" },
] as const;
type Id = (typeof SPIELE)[number]["id"];

export default function Spiele({ post, empfangen }: { post?: Geheimpost; empfangen?: Empfangen | null }) {
  const [spiel, setSpiel] = useState<Id>(empfangen ? "geheim" : "bitfall");
  // angenommene Post: gleich zur Geheimbotschaft
  useEffect(() => { if (empfangen) setSpiel("geheim"); }, [empfangen]);
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={spiel} setze={setSpiel} optionen={SPIELE} />
      <div className="card p-4 sm:p-5">
        {spiel === "bitfall" && <BitFall />}
        {spiel === "zaehlwerk" && <ZaehlwerkRennen />}
        {spiel === "geheim" && <Geheimbotschaft post={post} empfangen={empfangen} />}
      </div>
    </div>
  );
}
