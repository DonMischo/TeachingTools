"use client";
/**
 * Die Spiele zur Prozentrechnung: Prozent-Blitz (schnell, gegen die Uhr) und
 * drei Alltagsspiele — Saftbar (Mischen), Handy-Check (Ratenkauf, Vertrag),
 * Mein Kiosk (Kalkulation mit Aufschlag und Mehrwertsteuer).
 */
import { useState } from "react";
import Spiel from "./Spiel";
import Saftbar from "./spiele/Saftbar";
import HandyCheck from "./spiele/HandyCheck";
import Kiosk from "./spiele/Kiosk";
import { Chips } from "./ui";

const SPIELE = [
  { id: "blitz", label: "⚡ Prozent-Blitz" },
  { id: "saft", label: "🧃 Saftbar" },
  { id: "handy", label: "📱 Handy-Check" },
  { id: "kiosk", label: "🏪 Mein Kiosk" },
] as const;
type Id = (typeof SPIELE)[number]["id"];

export default function Spiele() {
  const [spiel, setSpiel] = useState<Id>("blitz");
  return (
    <div className="flex flex-col gap-3">
      <Chips wahl={spiel} setze={setSpiel} optionen={SPIELE} />
      {spiel === "blitz" ? <Spiel /> : (
        <div className="card p-4 sm:p-5">
          {spiel === "saft" && <Saftbar />}
          {spiel === "handy" && <HandyCheck />}
          {spiel === "kiosk" && <Kiosk />}
        </div>
      )}
    </div>
  );
}
