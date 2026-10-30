"use client";
/**
 * Die »anderen« Apps auf dem Handy. Harmlos auf den ersten Blick — alle haben
 * dasselbe Werbe-SDK (AdKit) eingebaut, das im Hintergrund an Klikk weitergibt.
 */
import { useEffect, useRef, useState } from "react";
import { PRODUKTE, QUIZ, candyRunde, quizAntwort, recht, shopAnsehen } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import TeilenKnopf from "./Teilen";
import type { Online } from "./spiele/SpieleApp";

type Setze = (f: (s: Stand) => Stand) => void;

export function Wetter({ s, setze }: { s: Stand; setze: Setze }) {
  const tage = ["Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const wetter = ["☀️ 14°", "🌦️ 11°", "🌧️ 9°", "⛅ 12°", "☀️ 15°", "☀️ 19°"];
  return (
    <div className="p-4 flex flex-col gap-3 h-full bg-gradient-to-b from-sky-400/30 to-transparent">
      <div className="font-black text-lg">☁️ Wolke</div>
      {s.rechte.standort === undefined && (
        <div className="card p-3 text-sm">
          <b>»Wolke« möchte deinen Standort verwenden.</b>
          <p className="text-muted text-xs mt-1">Für genaues Wetter in deiner Nähe.</p>
          <div className="flex gap-2 mt-2">
            <button className="btn-secondary text-xs flex-1" onClick={() => setze(st => recht(st, "standort", false, "wetter"))}>Nicht erlauben</button>
            <button className="btn-primary text-xs flex-1" onClick={() => setze(st => recht(st, "standort", true, "wetter"))}>Beim Verwenden erlauben</button>
          </div>
        </div>
      )}
      <div className="text-center py-4">
        <div className="text-sm text-muted">{s.rechte.standort ? "📍 Deine Position" : "Deutschland"}</div>
        <div className="text-6xl font-black mt-1">{wetter[s.tag].split(" ")[1]}</div>
        <div className="text-4xl">{wetter[s.tag].split(" ")[0]}</div>
      </div>
      <div className="grid grid-cols-6 gap-1 text-center text-xs">
        {tage.map((t, i) => <div key={t} className={`card p-1 ${i === s.tag ? "ring-2 ring-accent" : ""}`}>{t}<br />{wetter[i]}</div>)}
      </div>
      <p className="text-[10px] text-muted mt-auto">Kostenlos dank Werbung · powered by AdKit</p>
    </div>
  );
}

export function Candy({ s, setze, online }: { s: Stand; setze: Setze; online?: Online }) {
  const [laeuft, setLaeuft] = useState(false);
  const [rest, setRest] = useState(15);
  const [punkte, setPunkte] = useState(0);
  const [an, setAn] = useState(0);
  /** zählt jeden Sprung des Bonbons — ein Treffer startet so die Sprung-Uhr neu */
  const [sprung, setSprung] = useState(0);
  const [fertig, setFertig] = useState<number | null>(null);
  const punkteRef = useRef(0);

  // Immer an eine andere Stelle springen, sonst sieht ein Sprung wie Stillstand aus
  const springe = () => { setAn(a => (a + 1 + Math.floor(Math.random() * 8)) % 9); setSprung(n => n + 1); };

  // Countdown: unabhängig vom Bonbon
  useEffect(() => {
    if (!laeuft) return;
    const t = setInterval(() => {
      setRest(r => {
        if (r <= 1) {
          setLaeuft(false);
          setFertig(punkteRef.current);
          setze(st => candyRunde(st, punkteRef.current));
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [laeuft, setze]);

  // Das Bonbon bleibt eine Sekunde stehen — nach jedem Sprung (auch nach einem Treffer) von vorn
  useEffect(() => {
    if (!laeuft) return;
    const t = setTimeout(springe, 1000);
    return () => clearTimeout(t);
  }, [laeuft, sprung]);

  const tippe = (i: number) => {
    if (!laeuft || i !== an) return;
    punkteRef.current += 10;
    setPunkte(punkteRef.current);
    springe();
  };

  return (
    <div className="p-4 flex flex-col gap-3 h-full bg-gradient-to-b from-pink-400/30 to-transparent">
      <div className="flex justify-between font-black"><span>🍬 Candy Blast</span><span>⭐ {punkte} · ⏱️ {rest}</span></div>
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }, (_, i) => (
          <button key={i} onClick={() => tippe(i)} className="aspect-square rounded-xl bg-surface-hover text-4xl grid place-items-center">
            {laeuft && i === an ? "🍬" : ""}
          </button>
        ))}
      </div>
      {!laeuft && fertig === null && <button className="btn-primary" onClick={() => { punkteRef.current = 0; setPunkte(0); setRest(15); setLaeuft(true); }}>▶ Spielen</button>}
      {fertig !== null && (
        <div className="card p-3 text-sm text-center">
          <b>{fertig} Punkte!</b>
          <p className="text-muted text-xs mt-1">💔 Keine Leben mehr. Warte 30 Minuten — oder hol dir 💎 Diamanten!</p>
          <button className="btn-secondary text-xs mt-2 w-full" disabled>💎 500 Diamanten · 4,99 €</button>
          <div className="mt-2 flex justify-center"><TeilenKnopf s={s} setze={setze} online={online} spiel="candy" punkte={fertig} /></div>
        </div>
      )}
      <p className="text-[10px] text-muted mt-auto">Kostenlos dank Werbung · powered by AdKit</p>
    </div>
  );
}

export function Sneakr({ setze }: { setze: Setze }) {
  const [offen, setOffen] = useState<string | null>(null);
  const p = PRODUKTE.find(x => x.id === offen);
  return (
    <div className="p-4 flex flex-col gap-3 h-full">
      <div className="font-black text-lg">👟 Sneakr</div>
      {p ? (
        <div className="card p-4 text-center">
          <div className="text-7xl">{p.emoji}</div>
          <div className="font-black mt-2">{p.name}</div>
          <div className="text-2xl font-black">{p.preis} €</div>
          <p className="text-xs text-muted mt-1">🔥 23 Leute sehen sich das gerade an!</p>
          <button className="btn-primary w-full mt-3" disabled>In den Warenkorb (kein Guthaben)</button>
          <button className="btn-secondary w-full mt-2 text-sm" onClick={() => setOffen(null)}>‹ Zurück</button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {PRODUKTE.map(x => (
            <button key={x.id} className="card p-3 hover:bg-surface-hover" onClick={() => { setOffen(x.id); setze(st => shopAnsehen(st, x.id)); }}>
              <div className="text-5xl">{x.emoji}</div>
              <div className="text-sm font-bold">{x.name}</div>
              <div className="text-xs text-muted">{x.preis} €</div>
            </button>
          ))}
        </div>
      )}
      <p className="text-[10px] text-muted mt-auto">powered by AdKit</p>
    </div>
  );
}

/** Das Ergebnis passt zu den Antworten — klingt aber, wie alle Typ-Tests, ein bisschen nach jedem (Barnum-Effekt). */
export function quizTyp(q: Record<string, string>) {
  if (q.aendern === "koerper") return { emoji: "🪞", name: "Die/der Selbstkritische", text: "Du siehst genau hin – vor allem bei dir selbst. Manchmal zu genau. Du bist strenger mit dir als mit anderen." };
  if (q.laune === "allein" || q.aendern === "freunde") return { emoji: "🌧️", name: "Die/der stille Beobachter·in", text: "Du merkst mehr, als du zeigst. In Gruppen hältst du dich zurück und fühlst dich trotzdem manchmal außen vor." };
  if ((q.schlaf === "spaet" || q.schlaf === "sehrspaet") && q.laune !== "gut") return { emoji: "🌙", name: "Die Nachteule", text: "Wenn alle schlafen, wirst du wach. Morgens ist die Welt dir zu laut und zu früh." };
  if (q.laune === "gestresst" || q.aendern === "noten" || q.eltern === "oft" || q.eltern === "immer") return { emoji: "⚡", name: "Die/der Getriebene", text: "Bei dir ist immer etwas los, und selten genug Zeit. Du willst viel – und manchmal will zu viel von dir." };
  if (q.laune === "gut" && q.aendern === "nichts") return { emoji: "☀️", name: "Der Sonnenschein", text: "Du bringst Licht in jeden Raum und bist im Reinen mit dir. Pass auf, dass andere das nicht ausnutzen." };
  return { emoji: "🌀", name: "Die/der Vielseitige", text: "Mal so, mal so – dich in eine Schublade zu stecken, klappt nicht. Das finden manche anstrengend, die meisten spannend." };
}

export function Quiz({ s, setze, online }: { s: Stand; setze: Setze; online?: Online }) {
  const frage = QUIZ.find(q => !s.quiz[q.id]);
  return (
    <div className="p-4 flex flex-col gap-3 h-full bg-gradient-to-b from-amber-300/30 to-transparent">
      <div className="font-black text-lg">✨ Welcher Typ bist du?</div>
      {frage ? (
        <>
          <p className="text-xs text-muted">Frage {QUIZ.indexOf(frage) + 1} von {QUIZ.length} · 100 % anonym!</p>
          <div className="card p-3 font-bold">{frage.frage}</div>
          {frage.antworten.map(([id, text]) => (
            <button key={id} className="btn-secondary text-left" onClick={() => setze(st => quizAntwort(st, frage.id, id))}>{text}</button>
          ))}
        </>
      ) : (
        <div className="card p-4 text-center flex flex-col items-center gap-1">
          <div className="text-6xl">{quizTyp(s.quiz).emoji}</div>
          <div className="font-black text-xl mt-2">Du bist: {quizTyp(s.quiz).name}</div>
          <p className="text-sm text-muted mt-1">{quizTyp(s.quiz).text}</p>
          {online !== undefined && <TeilenKnopf s={s} setze={setze} online={online} spiel="quiz" punkte={0} tipp={quizTyp(s.quiz).name} />}
        </div>
      )}
      <p className="text-[10px] text-muted mt-auto">powered by AdKit</p>
    </div>
  );
}

