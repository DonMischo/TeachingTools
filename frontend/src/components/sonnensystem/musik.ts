/**
 * Hintergrundmusik der Simulation: ein Stück in Endlosschleife, wobei jeder
 * Durchlauf 3 s vor dem Ende den nächsten startet und beide überblendet.
 *
 * Web Audio statt <audio loop>: nur so lassen sich zwei Durchläufe sample-genau
 * überlappen. Browser erlauben Ton erst nach einer Geste — deshalb startet die
 * Musik beim ersten Klick/Tipp/Tastendruck, falls sie davor schon an war.
 */
import { useEffect, useState } from "react";

const DATEI = "/sonnensystem/musik/weltraum.mp3";
const UEBERLAPPUNG = 3;
const LAUTSTAERKE = 0.35;
const SPEICHER = "hp_sonnensystem_musik";

let ctx: AudioContext | null = null;
let haupt: GainNode | null = null;
let puffer: Promise<AudioBuffer> | null = null;
let timer: number | null = null;
let laufende: { quelle: AudioBufferSourceNode; gain: GainNode }[] = [];
/** Steigt bei jedem Stopp: ein noch ladender Start von davor plant dann nichts mehr. */
let runde = 0;

function kontext() {
  if (!ctx) {
    ctx = new AudioContext();
    haupt = ctx.createGain();
    haupt.gain.value = LAUTSTAERKE;
    haupt.connect(ctx.destination);
  }
  return ctx;
}

function lade(c: AudioContext) {
  puffer ??= fetch(DATEI).then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b));
  return puffer;
}

/** Einen Durchlauf ab `start` einplanen und den nächsten 3 s vor dessen Ende. */
function plane(c: AudioContext, buf: AudioBuffer, start: number, erster: boolean) {
  const gain = c.createGain();
  const quelle = c.createBufferSource();
  quelle.buffer = buf;
  quelle.connect(gain).connect(haupt!);
  const ende = start + buf.duration;
  const f = Math.min(UEBERLAPPUNG, buf.duration / 2);
  // Ein- und Ausblenden über die Überlappung: zusammen bleibt die Lautstärke gleich.
  gain.gain.setValueAtTime(erster ? 1 : 0, start);
  if (!erster) gain.gain.linearRampToValueAtTime(1, start + f);
  gain.gain.setValueAtTime(1, ende - f);
  gain.gain.linearRampToValueAtTime(0, ende);
  quelle.start(start);
  const eintrag = { quelle, gain };
  laufende.push(eintrag);
  quelle.onended = () => { laufende = laufende.filter(e => e !== eintrag); };
  const naechster = ende - f;
  // Kurz vorher einplanen; der Timer muss nicht genau sein, start() ist es.
  timer = window.setTimeout(() => plane(c, buf, naechster, false), Math.max(0, (naechster - c.currentTime - 1) * 1000));
}

async function starte() {
  const c = kontext();
  const meine = runde;
  if (c.state === "suspended") await c.resume().catch(() => {});
  if (laufende.length || timer !== null) return;
  const buf = await lade(c);
  if (meine !== runde || laufende.length || timer !== null) return;
  plane(c, buf, c.currentTime + 0.05, true);
}

function stoppe() {
  runde++;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  for (const { quelle } of laufende) { try { quelle.stop(); } catch { /* schon aus */ } }
  laufende = [];
}

/** Musik an/aus, gemerkt je Gerät. Spielt, solange die Komponente steht. */
export function useMusik(): [boolean, () => void] {
  const [an, setAn] = useState(true);

  useEffect(() => {
    try { if (localStorage.getItem(SPEICHER) === "aus") setAn(false); } catch { /* ohne Speicher: an */ }
  }, []);

  useEffect(() => {
    if (!an) { stoppe(); return; }
    const versuche = () => { starte().catch(() => {}); };
    versuche();
    // Ohne vorherige Geste bleibt der Kontext stumm — beim ersten Klick weiter.
    const ereignisse = ["pointerdown", "keydown", "touchend"] as const;
    for (const e of ereignisse) window.addEventListener(e, versuche, { once: true });
    return () => {
      for (const e of ereignisse) window.removeEventListener(e, versuche);
      stoppe();
    };
  }, [an]);

  const umschalten = () => setAn(a => {
    try { localStorage.setItem(SPEICHER, a ? "aus" : "an"); } catch { /* egal */ }
    return !a;
  });
  return [an, umschalten];
}
