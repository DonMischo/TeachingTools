"use client";
/**
 * Stufe 7: Speichern und Wiederfinden.
 *
 * Der Führerschein wird als PNG-Bild gezeichnet — ein Bild, weil »Bild
 * speichern unter …« im Rechtsklick-Menü eine echte Datei mit genau diesen
 * Bytes ablegt. »Seite speichern« dagegen legte die ganze App samt Ordner ab.
 *
 * Danach holt das Kind die Datei im Explorer wieder und zieht sie zurück auf
 * die Seite. Geprüft wird nur im Browser (Prüfsumme über den Inhalt, siehe
 * lib/maus/ergebnis.ts) — nichts davon geht an den Server.
 */
import { useEffect, useRef, useState } from "react";
import { AVATARS } from "@/components/AvatarPicker";
import {
  bekannteBlaetter, merkeBlatt, nichtssagenderName, pruefsumme, sterne, teilSumme,
  type Ergebnisse, type StufeId, type Teil,
} from "@/lib/maus/ergebnis";
import { tierName } from "@/lib/maus/tiere";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo } from "./Demo";
import { leinwandAlsPdf } from "@/lib/maus/pdf";

const W = 1240;
const H = 1754;
const EMOJI = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
const SCHRIFT = '"Segoe UI",system-ui,sans-serif';
const BLAU = "#2563eb";

export const BLATT_STUFEN: Record<Teil, { id: StufeId; icon: string; titel: string }[]> = {
  1: [
    { id: "klick", icon: "👆", titel: "Klicken" },
    { id: "doppelklick", icon: "✌️", titel: "Doppelklick" },
    { id: "rechtsklick", icon: "📋", titel: "Rechtsklick" },
    { id: "ziehen", icon: "✋", titel: "Ziehen und Ablegen" },
    { id: "markieren", icon: "🖍️", titel: "Markieren" },
    { id: "kopieren", icon: "📄", titel: "Kopieren und Einfügen" },
  ],
  2: [
    { id: "scrollen", icon: "🖱️", titel: "Scrollen" },
    { id: "tastatur", icon: "⌨️", titel: "Tastatur" },
    { id: "explorer", icon: "📁", titel: "Dateien ordnen" },
    { id: "fenster", icon: "🪟", titel: "Fenster" },
    { id: "screenshot", icon: "📸", titel: "Bildschirmfoto" },
  ],
  3: [
    { id: "suche", icon: "🔍", titel: "Windows-Suche" },
    { id: "apps", icon: "🧰", titel: "Welche App wofür?" },
    { id: "aussehen", icon: "🎨", titel: "Hintergrund & Farben" },
    { id: "bedienhilfe", icon: "🔎", titel: "Zeiger & Textgröße" },
    { id: "taskleiste", icon: "📌", titel: "Taskleiste & Start" },
    { id: "profil", icon: "🔒", titel: "Profil & Sperrbildschirm" },
  ],
};

const UNTERTITEL: Record<Teil, string> = {
  1: "Grundkurs: Maus und Tastatur",
  2: "Teil 2: Tastatur, Dateien und Fenster",
  3: "Teil 3: Suchen, Apps und Aussehen",
};

const zahl = (n: number) => n.toLocaleString("de-DE");

function rund(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function zeichneFuehrerschein(
  ctx: CanvasRenderingContext2D,
  d: { name: string; avatar: string; ergebnisse: Ergebnisse; datum: string; teil: Teil; bestanden: boolean },
) {
  const av = AVATARS.find(a => a.id === d.avatar) ?? AVATARS[0];
  ctx.fillStyle = "#fffdf7";
  ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = "middle";

  // Rahmen und Kopfband
  ctx.strokeStyle = BLAU;
  ctx.lineWidth = 14;
  rund(ctx, 40, 40, W - 80, H - 80, 36);
  ctx.stroke();
  ctx.fillStyle = BLAU;
  rund(ctx, 64, 64, W - 128, 240, 24);
  ctx.fill();
  ctx.textAlign = "center";
  ctx.font = `140px ${EMOJI}`;
  ctx.fillText("🐭", 190, 186);
  ctx.fillStyle = "#fff";
  ctx.font = `900 80px ${SCHRIFT}`;
  ctx.fillText("MAUS-FÜHRERSCHEIN", W / 2 + 70, 160, W - 420);
  ctx.font = `500 34px ${SCHRIFT}`;
  ctx.fillText(UNTERTITEL[d.teil], W / 2 + 70, 236);

  // Tier
  ctx.fillStyle = av.bg;
  ctx.beginPath();
  ctx.arc(W / 2, 430, 95, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.font = `120px ${EMOJI}`;
  ctx.fillText(av.emoji, W / 2, 438);

  // Name
  ctx.fillStyle = "#6b7280";
  ctx.font = `500 32px ${SCHRIFT}`;
  ctx.fillText("ausgestellt für", W / 2, 572);
  ctx.fillStyle = "#111827";
  ctx.font = `800 72px ${SCHRIFT}`;
  ctx.fillText(d.name.trim() || "__________________", W / 2, 638, W - 300);
  ctx.fillStyle = "#6b7280";
  ctx.font = `500 30px ${SCHRIFT}`;
  ctx.fillText(`am ${d.datum} · Begleiter: ${tierName(av.id)}`, W / 2, 696);

  // Stempel für die bestandene Prüfung — schräg, wie aufgedrückt.
  if (d.bestanden) {
    ctx.save();
    ctx.translate(W - 250, 450);
    ctx.rotate(-0.22);
    ctx.strokeStyle = "#16a34a";
    ctx.fillStyle = "#16a34a";
    ctx.lineWidth = 7;
    rund(ctx, -165, -58, 330, 116, 18);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.font = `900 40px ${SCHRIFT}`;
    ctx.fillText("PRÜFUNG", 0, -16);
    ctx.fillText("BESTANDEN", 0, 30);
    ctx.restore();
    ctx.textAlign = "center";
  }

  // Stufen
  let y = 750;
  for (const s of BLATT_STUFEN[d.teil]) {
    const e = d.ergebnisse[s.id];
    ctx.fillStyle = e ? "#f0f7ff" : "#f5f5f4";
    rund(ctx, 100, y, W - 200, 110, 20);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.font = `56px ${EMOJI}`;
    ctx.fillText(s.icon, 128, y + 56);
    ctx.fillStyle = "#111827";
    ctx.font = `700 40px ${SCHRIFT}`;
    ctx.fillText(s.titel, 212, y + (e ? 38 : 56));
    if (e) {
      ctx.fillStyle = "#4b5563";
      ctx.font = `400 25px ${SCHRIFT}`;
      ctx.fillText(e.details.join(" · "), 212, y + 80, 620);
      ctx.textAlign = "right";
      ctx.fillStyle = "#111827";
      ctx.font = `800 40px ${SCHRIFT}`;
      ctx.fillText(zahl(e.punkte), W - 330, y + 42);
      const n = sterne(s.id, e.punkte);
      ctx.fillStyle = "#f59e0b";
      ctx.font = `700 30px ${SCHRIFT}`;
      ctx.fillText("★".repeat(n) + "☆".repeat(3 - n), W - 330, y + 82);
      ctx.fillStyle = "#16a34a";
      rund(ctx, W - 305, y + 30, 180, 50, 25);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.textAlign = "center";
      ctx.font = `700 26px ${SCHRIFT}`;
      ctx.fillText("✔ bestanden", W - 215, y + 56);
    } else {
      ctx.textAlign = "right";
      ctx.fillStyle = "#9ca3af";
      ctx.font = `italic 500 30px ${SCHRIFT}`;
      ctx.fillText("übersprungen", W - 140, y + 56);
    }
    y += 125;
  }

  // Summe
  ctx.textAlign = "center";
  ctx.fillStyle = BLAU;
  ctx.font = `900 64px ${SCHRIFT}`;
  ctx.fillText(`Gesamt: ${zahl(teilSumme(d.ergebnisse, d.teil))} Punkte`, W / 2, y + 50);
  ctx.fillStyle = "#9ca3af";
  ctx.font = `500 26px ${SCHRIFT}`;
  ctx.fillText("TT - Teaching Tools · Maus-Führerschein", W / 2, H - 96);
}

type Browser = "chrome" | "firefox";

const MENUE: Record<Browser, string[]> = {
  chrome: ["Bild in neuem Tab öffnen", "Bild speichern unter …", "Bild kopieren", "Bildadresse kopieren"],
  firefox: ["Grafik in neuem Tab öffnen", "Grafik speichern unter …", "Grafik kopieren", "Grafikadresse kopieren"],
};

function Kbd({ children }: { children: string }) {
  return <kbd className="inline-block rounded-md border border-line bg-surface-hover px-1.5 py-0.5 text-xs font-bold shadow-[0_2px_0_var(--border)]">{children}</kbd>;
}

export default function StufeSpeichern({
  avatar, name, ergebnisse, onWeiter, teil = 1, bestanden = false,
}: {
  avatar: string;
  name: string;
  ergebnisse: Ergebnisse;
  onWeiter: () => void;
  teil?: Teil;
  /** Prüfung dieses Teils bestanden — dann trägt das Blatt den Stempel. */
  bestanden?: boolean;
}) {
  const [blattName, setBlattName] = useState(name);
  const [bild, setBild] = useState<{ url: string; hash: string } | null>(null);
  const [browser, setBrowser] = useState<Browser>("chrome");
  const [ueber, setUeber] = useState(false);
  const [fund, setFund] = useState<{ ok: true; datei: string } | { ok: false; text: string } | null>(null);
  const bildRef = useRef<HTMLImageElement>(null);
  const menueRef = useRef<HTMLDivElement>(null);
  const ablageRef = useRef<HTMLDivElement>(null);
  const waehler = useRef<HTMLInputElement>(null);
  const demo = useDemo();

  useEffect(() => { setBlattName(n => n || name); }, [name]);
  useEffect(() => { if (/firefox/i.test(navigator.userAgent)) setBrowser("firefox"); }, []);

  // Das Blatt neu zeichnen, sobald sich Name oder Ergebnisse ändern.
  useEffect(() => {
    let aus = false;
    const uhr = setTimeout(() => {
      const leinwand = document.createElement("canvas");
      leinwand.width = W;
      leinwand.height = H;
      let ctx: CanvasRenderingContext2D | null = null;
      try { ctx = leinwand.getContext("2d"); } catch {}
      if (!ctx) return;
      zeichneFuehrerschein(ctx, {
        name: blattName, avatar, ergebnisse, datum: new Date().toLocaleDateString("de-DE"), teil, bestanden,
      });
      leinwand.toBlob(async blob => {
        if (!blob || aus) return;
        const hash = pruefsumme(await blob.arrayBuffer());
        if (aus) return;
        merkeBlatt(hash);
        const url = URL.createObjectURL(blob);
        setBild(alt => { if (alt) URL.revokeObjectURL(alt.url); return { url, hash }; });
      }, "image/png");
    }, 400);
    return () => { aus = true; clearTimeout(uhr); };
  }, [blattName, avatar, ergebnisse, teil, bestanden]);

  // Daneben fallen gelassene Dateien soll der Browser nicht öffnen — sonst ist die Seite weg.
  useEffect(() => {
    const halt = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", halt);
    window.addEventListener("drop", halt);
    return () => { window.removeEventListener("dragover", halt); window.removeEventListener("drop", halt); };
  }, []);

  async function pruefe(datei: File | undefined) {
    if (!datei) return;
    const hash = pruefsumme(await datei.arrayBuffer());
    if (bekannteBlaetter().includes(hash)) setFund({ ok: true, datei: datei.name });
    else if (!datei.type.startsWith("image/")) {
      setFund({ ok: false, text: `»${datei.name}« ist kein Bild. Gesucht ist dein Führerschein — eine Bilddatei (PNG).` });
    } else {
      setFund({ ok: false, text: `»${datei.name}« ist ein anderes Bild. Hast du die richtige Datei erwischt?` });
    }
  }

  /**
   * Zusätzlich zum Speichern-Üben: das Blatt als PDF — zum Drucken oder
   * Abgeben. Gezeichnet wird frisch, damit auch ein gerade geänderter Name
   * im PDF steht.
   */
  async function alsPdf() {
    const leinwand = document.createElement("canvas");
    leinwand.width = W;
    leinwand.height = H;
    const ctx = leinwand.getContext("2d");
    if (!ctx) return;
    zeichneFuehrerschein(ctx, {
      name: blattName, avatar, ergebnisse, datum: new Date().toLocaleDateString("de-DE"), teil, bestanden,
    });
    const url = URL.createObjectURL(await leinwandAlsPdf(leinwand));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Maus-Führerschein${teil > 1 ? ` Teil ${teil}` : ""} ${blattName.trim() || "ohne Namen"}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  function vorfuehren() {
    const eintrag = () => menueRef.current?.querySelector("[data-speichern]") ?? null;
    demo.abspielen([
      { text: "Zeige auf deinen Führerschein.", zu: () => mitte(bildRef.current) },
      { text: "Drücke die rechte Taste.", taste: "rechts" },
      { text: `Im Menü: »${MENUE[browser][1]}« — mit links anklicken.`, zu: () => mitte(eintrag()) },
      { text: "Einen Ordner wählen, einen Namen eintippen, »Speichern«.", taste: null },
      { text: "Wiederfinden: Windows-Taste + E öffnet den Explorer.", tasten: ["MetaLeft", "KeyE"] },
      { text: "Die Datei mit gedrückter linker Taste hierher ziehen.", taste: "halten", zu: () => mitte(ablageRef.current) },
      { text: "Loslassen — fertig!", taste: null },
    ]);
  }

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel={teil === 1 ? "💾 Stufe 7 · Speichern und Wiederfinden" : `💾 Teil ${teil} · Urkunde speichern`}
        auftrag={<>Speichere deinen Führerschein auf dem Computer — mit <b>Rechtsklick auf das Bild</b>. Dann suche die Datei im <b>Explorer</b> und ziehe sie hierher zurück.</>}
        punkte={teilSumme(ergebnisse, teil)}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        weiterText="🏆 Zur Bestenliste"
        hervor={fund?.ok === true}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-bold">Name auf dem Führerschein</span>
            <input
              value={blattName}
              onChange={e => setBlattName(e.target.value.slice(0, 40))}
              placeholder="Dein Vorname"
              className="rounded-lg border border-line bg-page px-3 py-2"
            />
          </label>
          <button
            type="button"
            onClick={alsPdf}
            data-testid="pdf-knopf"
            className="self-start text-sm rounded-lg px-3 py-1.5 border border-line hover:border-accent"
          >
            📄 Als PDF herunterladen
          </button>
          <div className="card p-3 flex justify-center">
            {bild ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={bildRef}
                src={bild.url}
                alt="Dein Maus-Führerschein"
                className="max-h-[70vh] w-auto rounded-lg shadow-lg"
                data-testid="fuehrerschein"
              />
            ) : (
              <div className="h-64 flex items-center justify-center text-muted">Führerschein wird gezeichnet …</div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <section className="card p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-black flex-1">A · Speichern</h3>
              {(["chrome", "firefox"] as const).map(b => (
                <button key={b} onClick={() => setBrowser(b)} aria-pressed={browser === b}
                  className={"text-xs rounded-lg px-2 py-1 border " + (browser === b ? "border-accent text-accent font-bold" : "border-line")}>
                  {b === "chrome" ? "Chrome" : "Firefox"}
                </button>
              ))}
            </div>
            <ol className="list-decimal pl-5 text-sm flex flex-col gap-1.5 leading-snug">
              <li>Zeige mit der Maus auf deinen Führerschein und drücke die <b>rechte</b> Maustaste.</li>
              <li>Wähle <b>»{MENUE[browser][1]}«</b>:</li>
            </ol>
            <div
              ref={menueRef}
              aria-hidden
              className="self-start ml-5 min-w-[240px] p-1 select-none"
              style={{
                fontFamily: '"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif', fontSize: 13, color: "#1a1a1a",
                background: "#f9f9f9", border: "1px solid rgba(0,0,0,.12)", borderRadius: 8, boxShadow: "0 6px 14px rgba(0,0,0,.12)",
              }}
            >
              {MENUE[browser].map((t, i) => (
                <div key={t} data-speichern={i === 1 || undefined} className="h-7 px-3 flex items-center rounded-sm"
                  style={i === 1 ? { background: "rgba(37,99,235,.15)", fontWeight: 700 } : undefined}>
                  {t}
                </div>
              ))}
            </div>
            <ol start={3} className="list-decimal pl-5 text-sm flex flex-col gap-1.5 leading-snug">
              <li>Links einen Ordner wählen, z. B. <b>»Bilder«</b> oder <b>»Downloads«</b>.</li>
              <li>Bei <b>Dateiname</b> einen Namen eintippen, den du wiederfindest, z. B. <b>»Maus-Führerschein {blattName.trim().split(" ")[0] || "Mia"}«</b>.</li>
              <li>Auf <b>»Speichern«</b> klicken.</li>
            </ol>
          </section>

          <section className="card p-4 flex flex-col gap-3">
            <h3 className="font-black">B · Wiederfinden</h3>
            <ol className="list-decimal pl-5 text-sm flex flex-col gap-1.5 leading-snug">
              <li>Öffne den <b>Explorer</b>: <Kbd>⊞ Windows</Kbd> + <Kbd>E</Kbd> drücken — oder unten in der Taskleiste auf den gelben Ordner 📁 klicken.</li>
              <li>Klicke links auf den Ordner, in dem du gespeichert hast.</li>
              <li>Such deine Datei. Schiebe das Explorer-Fenster so, dass du dieses Feld hier noch siehst.</li>
              <li>Ziehe die Datei mit <b>gedrückter linker Maustaste</b> in das Feld und lass los.</li>
            </ol>
            <div
              ref={ablageRef}
              onDragOver={e => { e.preventDefault(); setUeber(true); }}
              onDragLeave={() => setUeber(false)}
              onDrop={e => { e.preventDefault(); setUeber(false); pruefe(e.dataTransfer.files[0]); }}
              data-testid="ablage"
              className={
                "rounded-2xl border-4 border-dashed p-6 text-center transition-colors " +
                (ueber ? "border-accent bg-surface-hover" : fund?.ok ? "border-ok" : "border-line")
              }
            >
              {fund?.ok ? (
                <div className="flex flex-col gap-2 items-center">
                  <div className="text-5xl">🏆</div>
                  <div className="text-lg font-black">Gefunden! Das ist dein Führerschein.</div>
                  <div className="text-sm">Du hast den Maus-Führerschein bestanden.</div>
                  {nichtssagenderName(fund.datei) && (
                    <div className="text-xs text-muted max-w-sm">
                      💡 Deine Datei heißt »{fund.datei}«. Gib Dateien beim Speichern lieber einen Namen, den du wiedererkennst.
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 items-center">
                  <div className="text-4xl">📥</div>
                  <div className="font-bold">Datei hierher ziehen</div>
                  <button onClick={() => waehler.current?.click()} className="text-xs underline text-muted">
                    … oder hier klicken und die Datei auswählen
                  </button>
                  {fund && !fund.ok && <div className="text-sm font-bold text-bad">{fund.text}</div>}
                </div>
              )}
              <input ref={waehler} type="file" accept="image/*" hidden onChange={e => { pruefe(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <p className="text-xs text-muted">Die Datei bleibt auf deinem Computer — sie wird nur hier im Browser verglichen, nicht hochgeladen.</p>
          </section>
        </div>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
