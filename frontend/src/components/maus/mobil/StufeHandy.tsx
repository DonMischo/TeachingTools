"use client";
/**
 * Teil 4 · Handy bedienen: Schnelleinstellungen bzw. Kontrollzentrum per
 * Wisch öffnen, »Nicht stören« und Bluetooth schalten, zurück zum
 * Startbildschirm wischen, Bildschirmfoto mit zwei Tasten, Handy sperren.
 *
 * Wischen geht mit der Maus: drücken, ziehen, loslassen. Zwei Tasten
 * »gleichzeitig« kann eine Maus nicht — es reicht, sie kurz nacheinander zu
 * klicken (GLEICHZEITIG_MS).
 */
import { useEffect, useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { BEDIEN_AUFGABEN, GLEICHZEITIG_MS, istWisch } from "@/lib/maus/mobil";
import { useAufgabenStufe } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "../Demo";
import { Handy, MobilRahmen, Startbildschirm, TASTEN_NAME, type HandyTaste, type StartApp } from "./Handy";

const APPS: StartApp[] = [
  { id: "kamera", name: "Kamera", icon: "📷", farbe: "#374151" },
  { id: "fotos", name: "Fotos", icon: "🖼️", farbe: "#f472b6" },
  { id: "uhr", name: "Uhr", icon: "⏰", farbe: "#111827" },
  { id: "wetter", name: "Wetter", icon: "⛅", farbe: "#38bdf8" },
  { id: "rechner", name: "Rechner", icon: "🧮", farbe: "#f59e0b" },
  { id: "karten", name: "Karten", icon: "🗺️", farbe: "#22c55e" },
  { id: "notizen", name: "Notizen", icon: "📝", farbe: "#facc15" },
  { id: "musik", name: "Musik", icon: "🎵", farbe: "#ef4444" },
];
const DOCK: StartApp[] = [
  { id: "telefon", name: "Telefon", icon: "📞", farbe: "#22c55e" },
  { id: "nachrichten", name: "Nachrichten", icon: "💬", farbe: "#3b82f6" },
  { id: "browser", name: "Browser", icon: "🌐", farbe: "#0ea5e9" },
];

/** Welche zwei Tasten ergeben ein Bildschirmfoto? */
const FOTO_TASTEN = { android: ["seite", "leiser"], ios: ["seite", "lauter"] } as const;

export default function StufeHandy({ avatar, onFertig, onWeiter }: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { handy: system, hilfe } = useMausKontext();
  const ios = system === "ios";
  const { schritt, setFehler, hinweis, setHinweis, fertig, weiterMit, punkte } = useAufgabenStufe("handy", BEDIEN_AUFGABEN.length, onFertig);
  const [panel, setPanel] = useState(false);
  const [ruhe, setRuhe] = useState(false);
  const [bt, setBt] = useState(true);
  const [wlan, setWlan] = useState(true);
  const [gesperrt, setGesperrt] = useState(false);
  const [blitz, setBlitz] = useState(false);
  const [gedrueckt, setGedrueckt] = useState<{ taste: HandyTaste; zeit: number } | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const bildschirm = useRef<HTMLDivElement>(null);
  const demo = useDemo();
  const aufgabe = BEDIEN_AUFGABEN[Math.min(schritt, BEDIEN_AUFGABEN.length - 1)];

  useEffect(() => {
    if (!gedrueckt) return;
    const uhr = setTimeout(() => setGedrueckt(null), GLEICHZEITIG_MS);
    return () => clearTimeout(uhr);
  }, [gedrueckt]);

  function falsch(text: string) {
    setFehler(f => f + 1);
    setHinweis({ text, gut: false });
  }

  function zeigerHoch(p: { x: number; y: number }) {
    const s = start.current;
    start.current = null;
    if (!s || fertig || demo.aktiv || gesperrt) return;
    if (Math.abs(p.y - s.y) < 0.08) return; // ein Tipp, kein Wisch
    if (aufgabe.id === "schnell" && !panel) {
      if (istWisch(s, p, "runter", ios ? { oben: 0.12, rechts: 0.5 } : { oben: 0.12 })) {
        setPanel(true);
        weiterMit(true, ios ? "Das Kontrollzentrum ist offen! ⭐" : "Die Schnelleinstellungen sind offen! ⭐");
      } else if (p.y > s.y) {
        falsch(ios ? "Fang ganz oben rechts an, bei Akku und WLAN." : "Fang ganz oben am Rand an.");
      }
      return;
    }
    if (aufgabe.id === "home" && panel) {
      if (istWisch(s, p, "hoch", { unten: 0.12 }) || istWisch(s, p, "hoch", { oben: 1 })) {
        setPanel(false);
        weiterMit(true, "Zurück auf dem Startbildschirm! ⭐");
      }
    }
  }

  function homeLeiste() {
    if (fertig || demo.aktiv || gesperrt) return;
    if (aufgabe.id === "home" && panel) {
      if (hilfe) { setPanel(false); weiterMit(true, "Zurück auf dem Startbildschirm! ⭐"); }
      else setHinweis({ text: "Fast: drück unten auf den Strich und zieh nach oben.", gut: false });
    }
  }

  function statusLeiste() {
    if (hilfe && aufgabe.id === "schnell" && !panel && !demo.aktiv) {
      setPanel(true);
      weiterMit(true, "Offen! Am echten Handy wischst du dafür. ⭐");
    }
  }

  function kachel(id: "ruhe" | "bt" | "wlan" | "lampe" | "flug") {
    if (fertig || demo.aktiv) return;
    if (id === "ruhe") {
      setRuhe(r => !r);
      if (aufgabe.id === "nichtstoeren" && !ruhe) weiterMit(true, "Ruhe! Jetzt piept nichts mehr. ⭐");
    } else if (id === "bt") {
      setBt(b => !b);
      if (aufgabe.id === "bluetooth" && bt) weiterMit(true, "Bluetooth ist aus. ⭐");
    } else if (id === "wlan") {
      setWlan(w => !w);
      if (aufgabe.id === "bluetooth") setHinweis({ text: "Das war WLAN — gesucht ist Bluetooth.", gut: false });
    } else {
      setHinweis({ text: "Schön, aber gerade nicht gefragt.", gut: false });
    }
  }

  function taste(t: HandyTaste) {
    if (fertig || demo.aktiv) return;
    if (gesperrt) { if (t === "seite") setGesperrt(false); return; }
    const partner = FOTO_TASTEN[system];
    if (aufgabe.id === "screenshot") {
      if (gedrueckt && gedrueckt.taste !== t && partner.includes(gedrueckt.taste as never) && partner.includes(t as never)) {
        setGedrueckt(null);
        setBlitz(true);
        setTimeout(() => setBlitz(false), 400);
        weiterMit(true, "Klick! Das Bildschirmfoto liegt jetzt in deinen Fotos. ⭐");
        return;
      }
      if (!partner.includes(t as never)) {
        falsch(`Das ist »${TASTEN_NAME[system][t]}«. Gebraucht: ${TASTEN_NAME[system][partner[0]]} und ${TASTEN_NAME[system][partner[1]]}.`);
        return;
      }
      setGedrueckt({ taste: t, zeit: Date.now() });
      setHinweis({ text: "Und jetzt schnell die zweite Taste!", gut: false });
      return;
    }
    if (aufgabe.id === "sperren" && t === "seite") {
      setGesperrt(true);
      weiterMit(true, "Gesperrt! Zum Entsperren drückst du die Taste noch einmal. ⭐");
      return;
    }
    if (t === "lauter" || t === "leiser") setHinweis({ text: t === "lauter" ? "🔊 Lauter" : "🔉 Leiser", gut: false });
  }

  function vorfuehren() {
    const ort = (sel: string) => () => mitte(bildschirm.current?.closest("[data-handy]")?.querySelector(sel) ?? null);
    const im = (fx: number, fy: number) => () => {
      const r = bildschirm.current?.getBoundingClientRect();
      return r ? { x: r.left + r.width * fx, y: r.top + r.height * fy } : null;
    };
    const s: DemoSchritt[] = [];
    if (aufgabe.id === "schnell") {
      s.push(
        { text: ios ? "Oben rechts drücken und festhalten …" : "Ganz oben drücken und festhalten …", zu: im(ios ? 0.8 : 0.5, 0.03), taste: "halten" },
        { text: "… nach unten ziehen und loslassen.", zu: im(ios ? 0.8 : 0.5, 0.45), taste: "halten" },
      );
    } else if (aufgabe.id === "nichtstoeren" || aufgabe.id === "bluetooth") {
      s.push({ text: aufgabe.tipp[system], zu: ort(`[data-kachel="${aufgabe.id === "bluetooth" ? "bt" : "ruhe"}"]`), taste: "links" });
    } else if (aufgabe.id === "home") {
      s.push(
        { text: "Unten am Strich drücken und festhalten …", zu: ort("[data-homeleiste]"), taste: "halten" },
        { text: "… nach oben ziehen und loslassen.", zu: im(0.5, 0.6), taste: "halten" },
      );
    } else if (aufgabe.id === "screenshot") {
      const [a, b] = FOTO_TASTEN[system];
      s.push(
        { text: `${TASTEN_NAME[system][a]} …`, zu: ort(`[data-taste="${a}"]`), taste: "links" },
        { text: `… und gleich danach ${TASTEN_NAME[system][b]}. Am echten Handy drückst du beide zusammen.`, zu: ort(`[data-taste="${b}"]`), taste: "links" },
      );
    } else {
      s.push({ text: `Kurz die ${TASTEN_NAME[system].seite} drücken.`, zu: ort('[data-taste="seite"]'), taste: "links" });
    }
    demo.abspielen(s);
  }

  const tile = (id: "ruhe" | "bt" | "wlan" | "lampe" | "flug", icon: string, name: string, an: boolean) => (
    <button
      key={id}
      type="button"
      data-kachel={id}
      aria-pressed={an}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
      onClick={() => kachel(id)}
      className={"flex items-center gap-2 text-left text-[12px] font-bold " + (ios ? "rounded-full justify-center flex-col" : "rounded-[20px] px-3")}
      style={ios
        ? { width: 58, height: 58, background: an ? (id === "ruhe" ? "#5e5ce6" : "#0a84ff") : "#ffffff33", color: "#fff" }
        : { height: 56, background: an ? "#a8c7fa" : "#e3e3e8", color: "#1f1f1f" }}
    >
      <span className="text-lg" aria-hidden>{icon}</span>
      {!ios && <span className="leading-tight">{name}<br /><span className="font-normal">{an ? "An" : "Aus"}</span></span>}
      {ios && <span className="sr-only">{name}</span>}
    </button>
  );

  const telefon = (
    <Handy
      system={system}
      bildschirmRef={bildschirm}
      schwarz={gesperrt}
      gedrueckt={gedrueckt ? [gedrueckt.taste] : []}
      onTaste={taste}
      onZeigerRunter={p => { start.current = p; }}
      onZeigerHoch={zeigerHoch}
      onHomeLeiste={homeLeiste}
      onStatusLeiste={statusLeiste}
      dunkel={panel && ios}
    >
      <Startbildschirm system={system} apps={APPS} dock={DOCK} onApp={() => setHinweis({ text: "Die App ist hier nicht wichtig — schau auf die Aufgabe.", gut: false })} />
      {panel && (
        <div
          data-panel
          className="absolute inset-0 z-20 flex flex-col gap-3 p-4"
          style={{ paddingTop: 52, background: ios ? "#1c1c1ee6" : "#f2f2f7f2", backdropFilter: "blur(12px)" }}
        >
          {ios ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-3xl p-3 grid grid-cols-2 gap-2 place-items-center" style={{ background: "#ffffff1f" }}>
                  {tile("flug", "✈️", "Flugmodus", false)}
                  {tile("wlan", "📶", "WLAN", wlan)}
                  {tile("bt", "🔵", "Bluetooth", bt)}
                  {tile("lampe", "🔦", "Taschenlampe", false)}
                </div>
                <div className="rounded-3xl p-3 flex flex-col justify-center gap-2" style={{ background: "#ffffff1f" }}>
                  <button
                    type="button"
                    data-kachel="ruhe"
                    aria-pressed={ruhe}
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => e.stopPropagation()}
                    onClick={() => kachel("ruhe")}
                    className="rounded-2xl px-3 py-3 text-left text-white text-[13px] font-bold"
                    style={{ background: ruhe ? "#5e5ce6" : "#ffffff26" }}
                  >
                    🌙 Fokus<br /><span className="font-normal text-[11px]">{ruhe ? "Nicht stören an" : "Aus"}</span>
                  </button>
                </div>
              </div>
              <div className="rounded-3xl h-24 flex items-center justify-around text-white text-2xl" style={{ background: "#ffffff1f" }} aria-hidden>
                ☀️ 🔊
              </div>
            </>
          ) : (
            <>
              <div className="h-8 rounded-full flex items-center px-3 text-sm" style={{ background: "#d3e3fd" }} aria-hidden>☀️ ━━━━━━━━○</div>
              <div className="grid grid-cols-2 gap-2">
                {tile("wlan", "📶", "Internet", wlan)}
                {tile("bt", "🔵", "Bluetooth", bt)}
                {tile("ruhe", "⛔", "Nicht stören", ruhe)}
                {tile("lampe", "🔦", "Taschenlampe", false)}
                {tile("flug", "✈️", "Flugmodus", false)}
              </div>
            </>
          )}
        </div>
      )}
      {blitz && <div className="absolute inset-0 z-50 bg-white" />}
    </Handy>
  );

  return (
    <>
      <MobilRahmen
        titel="📱 Teil 4 · Handy bedienen"
        avatar={avatar}
        fertig={fertig}
        auftrag={fertig
          ? <>Super — du kannst das Handy bedienen!</>
          : <>{aufgabe.text[system]}<div data-zusatz className="text-xs text-muted mt-1">💡 {aufgabe.tipp[system]}</div></>}
        punkte={punkte()}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        aufgaben={BEDIEN_AUFGABEN.map(a => a.kurz)}
        schritt={schritt}
        hinweis={hinweis}
        handy={telefon}
      />
      <DemoBuehne demo={demo} />
    </>
  );
}

