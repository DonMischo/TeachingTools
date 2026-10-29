"use client";
/**
 * Hinter jeder Anzeige eine Seite, die sich echt anfühlt: Countdown, »nur noch 2«,
 * vorausgefüllte Adresse, gespeicherte Karte, vorangekreuztes Abo. Bestellt wird
 * nie — beim letzten Klick klappt die Seite auf und zeigt ihre Tricks.
 */
import { useEffect, useState, type ReactNode } from "react";
import { werbungKlick } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

type Setze = (f: (s: Stand) => Stand) => void;
type Schritt = "seite" | "kasse" | "aufgeloest";

interface Seite {
  farbe: string;
  kopf: string;
  seite: (s: Stand) => ReactNode;
  knopf: string;
  kasse: (s: Stand) => ReactNode;
  bestellen: string;
  tricks: string[];
}

const TRACKER = ["Meta Pixel", "Google Ads", "TikTok Pixel", "Criteo", "Hotjar (zeichnet Mausbewegungen auf)", "AdKit"];

function Countdown({ start = 299 }: { start?: number }) {
  const [rest, setRest] = useState(start);
  useEffect(() => { const t = setInterval(() => setRest(r => (r > 0 ? r - 1 : start)), 1000); return () => clearInterval(t); }, [start]);
  return <span className="font-mono font-black">{String(Math.floor(rest / 60)).padStart(2, "0")}:{String(rest % 60).padStart(2, "0")}</span>;
}

const Sterne = ({ text, von }: { text: string; von: string }) => (
  <div className="rounded-lg bg-black/5 p-2 text-xs"><div className="text-amber-500">★★★★★</div>»{text}« <span className="text-zinc-500">– {von}, verifizierter Kauf ✔</span></div>
);

const SEITEN: Record<string, Seite> = {
  pizza: {
    farbe: "#dc2626", kopf: "🍕 Pizza Blitz",
    seite: s => (
      <>
        <div className="rounded-lg bg-red-50 text-red-700 p-2 text-xs font-bold">🔥 −30 % nur noch <Countdown /></div>
        <div className="text-xs">📍 Liefern an: <b>{s.rechte.standort ? "Zuhause (dein Standort wurde erkannt)" : "Adresse eingeben …"}</b></div>
        {[["🍕 Margherita", "7,90"], ["🍕 Salami XXL", "9,90"], ["🧀 Cheesy Crust", "11,90"]].map(([n, p]) => (
          <div key={n} className="flex justify-between border-b py-2 text-sm"><span>{n}</span><b>{p} €</b></div>
        ))}
        <div className="text-xs text-zinc-500">⭐ 4,8 · 🛵 in 20 Min. bei dir · 37 Bestellungen in deiner Nähe in der letzten Stunde</div>
      </>
    ),
    knopf: "In den Warenkorb – 9,90 €",
    kasse: () => (
      <>
        <div className="text-sm">Salami XXL · 9,90 €<br />Liefergebühr · 2,99 €<br />Servicegebühr · 1,49 €<br /><b>Gesamt 14,38 €</b></div>
        <div className="rounded-lg border p-2 text-sm">💳 Gespeicherte Karte <b>•••• 4242</b> (von Papas Handy synchronisiert)</div>
      </>
    ),
    bestellen: "Jetzt kostenpflichtig bestellen",
    tricks: ["Der Countdown fängt nach Ablauf von vorne an.", "»37 Bestellungen in deiner Nähe« – die Seite kennt deinen Standort.", "Aus 9,90 € werden mit Gebühren 14,38 €.", "Eine gespeicherte Karte macht Bezahlen zu einem einzigen Tipp."],
  },
  shake: {
    farbe: "#db2777", kopf: "🥤 SlimFast Pro",
    seite: () => (
      <>
        <div className="grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-lg bg-zinc-200 p-4 text-4xl">😩<br /><span className="text-xs">vorher</span></div><div className="rounded-lg bg-pink-100 p-4 text-4xl">😍<br /><span className="text-xs">nach 14 Tagen</span></div></div>
        <Sterne text="Ich habe 8 kg in 2 Wochen verloren!!" von="Jessi, 15" />
        <Sterne text="Endlich passt mein Lieblingskleid wieder" von="Mia" />
        <div className="text-xs font-bold text-red-600">⚠️ Nur noch 3 Pakete auf Lager!</div>
      </>
    ),
    knopf: "Jetzt testen – nur 1 €",
    kasse: () => (
      <>
        <div className="text-sm">Probierpaket · <b>1,00 €</b></div>
        <label className="flex gap-2 text-[10px] text-zinc-500 items-start"><input type="checkbox" defaultChecked /> Ich möchte nach dem Test das SlimFast-Abo (79,90 €/Monat, Laufzeit 12 Monate) erhalten.</label>
      </>
    ),
    bestellen: "Für 1 € bestellen",
    tricks: ["Das Häkchen beim Abo war schon gesetzt – 79,90 € im Monat, ein Jahr lang.", "»Jessi, 15« gibt es nicht. Gekaufte Bewertungen sind billig.", "»Nur noch 3« steht immer da.", "Diät-Shakes sind für Jugendliche im Wachstum gefährlich – das steht nirgends."],
  },
  energy: {
    farbe: "#16a34a", kopf: "⚡ VOLT Energy",
    seite: () => (
      <>
        <div className="text-center text-6xl">⚡🥫⚡</div>
        <div className="text-center font-black">12er-Pack · 14,99 €</div>
        <div className="text-xs text-zinc-500 text-center">Offizieller Drink von streamer.sven 🎮</div>
      </>
    ),
    knopf: "Kaufen",
    kasse: () => (
      <div className="rounded-lg border p-3 text-sm text-center">🔞 <b>Bist du mindestens 18?</b><div className="text-xs text-zinc-500 mt-1">Bitte bestätige dein Alter.</div></div>
    ),
    bestellen: "Ja, ich bin 18",
    tricks: ["Die Alterskontrolle war ein einziger Knopf.", "Ein großer Energy-Drink enthält so viel Koffein wie drei Tassen Kaffee – für Kinder und Jugendliche nicht empfohlen.", "»Nicht gesponsert« sagte der Streamer. Die Seite nennt ihn »offizieller Drink«."],
  },
  diamanten: {
    farbe: "#7c3aed", kopf: "💎 Candy Blast Shop",
    seite: () => (
      <>
        {[["💎 500", "4,99 €", ""], ["💎 1.200", "9,99 €", "BELIEBT"], ["💎 2.000 + 🎁", "14,99 €", "BESTES ANGEBOT"]].map(([n, p, b]) => (
          <div key={n} className={`flex justify-between rounded-lg border p-2 text-sm ${b === "BESTES ANGEBOT" ? "border-violet-500 bg-violet-50" : ""}`}><span>{n} {b && <span className="text-[9px] font-black text-violet-600">{b}</span>}</span><b>{p}</b></div>
        ))}
        <div className="text-xs">Ein Leben kostet 💎 45. Ein Booster 💎 120.</div>
      </>
    ),
    knopf: "2.000 💎 holen",
    kasse: () => <div className="rounded-xl bg-zinc-100 p-3 text-center text-sm">Mit <b>Face-ID</b> bezahlen<br /><span className="text-3xl">🙂</span><br /><span className="text-xs text-zinc-500">App-Store-Konto: Papa</span></div>,
    bestellen: "Doppelt drücken zum Bezahlen",
    tricks: ["Diamanten verstecken den echten Preis: 45 💎 klingen nach nichts.", "Das »beste Angebot« ist das teuerste.", "Ein Gesicht in die Kamera halten – fertig. Kein Nachdenken, keine Zahl.", "Spiele mit »Leben« und Wartezeit verkaufen das Warten-nicht-Müssen."],
  },
  nachhilfe: {
    farbe: "#2563eb", kopf: "📚 LernTurbo",
    seite: () => (
      <>
        <div className="text-center font-black text-lg">Bessere Noten in 7 Tagen – garantiert!</div>
        <Sterne text="Von 5 auf 2 in Mathe!" von="Tim" />
        <div className="text-xs text-center">Jetzt 7 Tage <b>kostenlos</b> testen</div>
      </>
    ),
    knopf: "Kostenlos testen",
    kasse: () => (
      <>
        <input className="border rounded p-1 text-sm w-full" placeholder="Deine Handynummer" readOnly />
        <input className="border rounded p-1 text-sm w-full" placeholder="E-Mail deiner Eltern" readOnly />
        <div className="text-[9px] text-zinc-400">Nach dem Test 29,99 €/Monat, Mindestlaufzeit 24 Monate. Kündigung schriftlich.</div>
      </>
    ),
    bestellen: "Test starten",
    tricks: ["»Kostenlos« für 7 Tage – danach 24 Monate à 29,99 € = 719,76 €.", "Die Bedingungen stehen in grauer Mini-Schrift.", "Handynummer und Eltern-Mail sind für LernTurbo mehr wert als dein Test."],
  },
  sneaker: {
    farbe: "#ea580c", kopf: "👟 Sneakr",
    seite: s => (
      <>
        <div className="text-center text-7xl">🏀</div>
        <div className="text-center font-black">{s.shopAngesehen[0] ?? "Jumpman Retro"} · <s className="text-zinc-400">189 €</s> 151 €</div>
        <div className="text-xs text-red-600 font-bold text-center">👀 23 Leute sehen sich das gerade an · Nur noch 1 in Größe 40!</div>
        <div className="text-xs text-center">Angebot endet in <Countdown start={540} /></div>
      </>
    ),
    knopf: "Größe 40 sichern",
    kasse: () => <div className="text-sm">151,00 € · <b>Jetzt kaufen, in 4 Raten zahlen</b> – nur 37,75 € pro Monat!</div>,
    bestellen: "Mit Ratenkauf bestellen",
    tricks: ["»23 Leute sehen sich das an« – die Zahl ist ausgedacht.", "Ratenkauf lässt 151 € klein aussehen. Schulden auch.", "Du hast die Schuhe vorher in einer anderen App angesehen – deshalb tauchten sie in Klikk auf."],
  },
  tarif: {
    farbe: "#0891b2", kopf: "📶 SimFlat",
    seite: () => <div className="text-center"><div className="text-5xl font-black">50 GB</div><div className="text-sm">nur 9,99 €*</div></div>,
    knopf: "Tarif sichern",
    kasse: () => <div className="text-[9px] text-zinc-400">*in den ersten 3 Monaten, danach 29,99 €/Monat, 24 Monate Laufzeit, Anschlussgebühr 39,99 €.</div>,
    bestellen: "Zahlungspflichtig bestellen",
    tricks: ["Das Sternchen: aus 9,99 € werden 29,99 € – plus 39,99 € Anschluss.", "Verträge darf man mit 14 eigentlich gar nicht ohne Eltern abschließen."],
  },
};

export default function Werbeseite({ id, s, setze, zu }: { id: string; s: Stand; setze: Setze; zu: () => void }) {
  const seite = SEITEN[id] ?? SEITEN.tarif;
  const [schritt, setSchritt] = useState<Schritt>("seite");
  useEffect(() => { setze(st => werbungKlick(st, id, "seite")); }, [id, setze]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white text-zinc-900">
      <div className="flex items-center gap-2 px-3 py-2 text-white" style={{ background: seite.farbe }}>
        <button onClick={zu} aria-label="Schließen" className="text-lg">✕</button>
        <span className="font-black flex-1">{seite.kopf}</span>
        <span className="text-[10px] opacity-80">🔒 {id}.shop</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {schritt === "seite" && seite.seite(s)}
        {schritt === "kasse" && seite.kasse(s)}
        {schritt === "aufgeloest" && (
          <div className="flex flex-col gap-2 text-sm">
            <div className="rounded-xl bg-amber-100 p-3 font-bold">✋ Stopp – hier wird nichts bestellt. Das ist ein Spiel.</div>
            <div className="font-black">Was diese Seite mit dir gemacht hat:</div>
            <ul className="list-disc pl-5 flex flex-col gap-1">{seite.tricks.map(t => <li key={t}>{t}</li>)}</ul>
            <div className="text-xs text-zinc-500 mt-2">Beim Öffnen geladen: {TRACKER.length} Tracker – {TRACKER.join(", ")}.</div>
          </div>
        )}
      </div>
      <div className="p-3 border-t">
        {schritt === "seite" && <button className="w-full rounded-xl py-3 font-black text-white" style={{ background: seite.farbe }}
          onClick={() => { setSchritt("kasse"); setze(st => werbungKlick(st, id, "kasse")); }}>{seite.knopf}</button>}
        {schritt === "kasse" && <button className="w-full rounded-xl py-3 font-black text-white" style={{ background: seite.farbe }}
          onClick={() => { setSchritt("aufgeloest"); setze(st => werbungKlick(st, id, "bestellt")); }}>{seite.bestellen}</button>}
        {schritt === "aufgeloest" && <button className="w-full rounded-xl py-3 font-black bg-zinc-900 text-white" onClick={zu}>Zurück zu Klikk</button>}
      </div>
    </div>
  );
}
