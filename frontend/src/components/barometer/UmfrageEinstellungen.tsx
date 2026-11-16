"use client";
import { useState } from "react";
import {
  GAST_MIN, gastAufteilen, gastMinuten, gastMinutenGueltig, type GastEinheit,
} from "@/lib/barometer";

type Wahl = "standard" | "eigen" | "offen";

/**
 * Anonym + Länge des Gastfensters. `guestMinutes`: null = Schulvorgabe,
 * 0 = bis die Umfrage geschlossen wird, sonst Minuten (NaN = Eingabe unbrauchbar).
 * Beim Laden einer anderen Umfrage per `key` neu einhängen — die Auswahl und
 * die Eingabe leben hier lokal.
 */
export function UmfrageEinstellungen({ anonymous, onAnonymous, guestMinutes, onGuestMinutes }: {
  anonymous: boolean;
  onAnonymous: (v: boolean) => void;
  guestMinutes: number | null;
  onGuestMinutes: (v: number | null) => void;
}) {
  const start = guestMinutes && guestMinutes > 0 ? gastAufteilen(guestMinutes) : { zahl: 2, einheit: "h" as GastEinheit };
  const [wahl, setWahl] = useState<Wahl>(guestMinutes === null ? "standard" : guestMinutes === 0 ? "offen" : "eigen");
  const [zahl, setZahl] = useState(String(start.zahl));
  const [einheit, setEinheit] = useState<GastEinheit>(start.einheit);

  function waehle(w: Wahl) {
    setWahl(w);
    onGuestMinutes(w === "standard" ? null : w === "offen" ? 0 : gastMinuten(Number(zahl), einheit));
  }
  function eigen(z: string, e: GastEinheit) {
    setZahl(z);
    setEinheit(e);
    onGuestMinutes(gastMinuten(Number(z), e));
  }

  const ungueltig = wahl === "eigen" && !gastMinutenGueltig(guestMinutes);

  return (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={anonymous} onChange={e => onAnonymous(e.target.checked)} />
        Anonym — Gäste geben keinen Namen ein
      </label>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span>Gastzugang offen:</span>
        <select aria-label="Dauer des Gastzugangs" className="input !w-auto text-sm py-1"
          value={wahl} onChange={e => waehle(e.target.value as Wahl)}>
          <option value="standard">Standard (Schulvorgabe)</option>
          <option value="eigen">Eigene Dauer</option>
          <option value="offen">Bis die Umfrage geschlossen wird</option>
        </select>
        {wahl === "eigen" && (
          <>
            <input aria-label="Dauer" type="number" min={1} className="input !w-20 text-sm py-1"
              value={zahl} onChange={e => eigen(e.target.value, einheit)} />
            <select aria-label="Einheit" className="input !w-auto text-sm py-1"
              value={einheit} onChange={e => eigen(zahl, e.target.value as GastEinheit)}>
              <option value="min">Minuten</option>
              <option value="h">Stunden</option>
              <option value="d">Tage</option>
            </select>
          </>
        )}
      </div>
      {wahl === "eigen" && (
        <p className={`text-xs ${ungueltig ? "text-(--danger,#dc2626)" : "text-muted"}`}>
          Zwischen {GAST_MIN} Minuten und 30 Tagen, gerechnet ab »Gäste erlauben«.
        </p>
      )}
    </div>
  );
}
