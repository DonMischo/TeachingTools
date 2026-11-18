"use client";
/**
 * Bausteine für Teil 4: ein nachgebautes Handy (Android oder iPhone) mit
 * Seitentasten, Statusleiste, Startbildschirm und den Einstellungen als
 * Liste — dazu der Rahmen, den jede Mobil-Stufe teilt (Stufenkopf, Handy
 * links, Aufgaben rechts, Umschalter Android/iOS).
 *
 * Keine echten Logos und kein echtes Aussehen der Hersteller-Apps: Formen und
 * Farben erinnern nur an die Systeme (iOS: graue Gruppen, grüne Schalter,
 * blaue Zurück-Pfeile; Android: schlichte Liste, blaue Schalter).
 */
import { useEffect, useRef, useState, type PointerEvent, type ReactNode, type Ref } from "react";
import { EINSTELLUNGEN, HANDY_NAME, START_WERTE, type HandySystem, type Wert, type Werte, type Zeile } from "@/lib/maus/mobil";
import { Stufenkopf } from "../Stufenkopf";
import { Hinweiszeile, type Hinweis } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { AvatarDisplay } from "@/components/AvatarPicker";
import { mitte, type DemoSchritt } from "../Demo";
import type { EinstellAufgabe } from "@/lib/maus/mobil";

export type HandyTaste = "lauter" | "leiser" | "seite" | "aktion";

const TASTEN: Record<HandySystem, { id: HandyTaste; label: string; seite: "links" | "rechts"; oben: number; hoehe: number }[]> = {
  android: [
    { id: "lauter", label: "Lauter", seite: "rechts", oben: 110, hoehe: 46 },
    { id: "leiser", label: "Leiser", seite: "rechts", oben: 162, hoehe: 46 },
    { id: "seite", label: "Ein/Aus-Taste", seite: "rechts", oben: 236, hoehe: 40 },
  ],
  ios: [
    { id: "aktion", label: "Aktionstaste", seite: "links", oben: 96, hoehe: 26 },
    { id: "lauter", label: "Lauter", seite: "links", oben: 140, hoehe: 46 },
    { id: "leiser", label: "Leiser", seite: "links", oben: 196, hoehe: 46 },
    { id: "seite", label: "Seitentaste", seite: "rechts", oben: 160, hoehe: 70 },
  ],
};

export const TASTEN_NAME: Record<HandySystem, Record<HandyTaste, string>> = {
  android: { lauter: "Lauter", leiser: "Leiser", seite: "Ein/Aus-Taste", aktion: "–" },
  ios: { lauter: "Lauter", leiser: "Leiser", seite: "Seitentaste", aktion: "Aktionstaste" },
};

function Uhrzeit() {
  const [jetzt, setJetzt] = useState<string>("");
  useEffect(() => {
    const stellen = () => setJetzt(new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
    stellen();
    const uhr = setInterval(stellen, 20000);
    return () => clearInterval(uhr);
  }, []);
  return <>{jetzt || "--:--"}</>;
}

/**
 * Das Handy-Gehäuse. `onZeigerRunter/Hoch` bekommen Anteile (0–1) des
 * Bildschirms — Wischgesten rechnen damit, unabhängig von der Größe.
 */
export function Handy({
  system, children, onTaste, gedrueckt = [], schwarz = false, dunkel = false,
  onZeigerRunter, onZeigerHoch, onHomeLeiste, onStatusLeiste, bildschirmRef,
}: {
  system: HandySystem;
  children?: ReactNode;
  onTaste?: (t: HandyTaste) => void;
  /** Gerade »gedrückte« Tasten (leuchten). */
  gedrueckt?: HandyTaste[];
  /** Bildschirm aus (gesperrt). */
  schwarz?: boolean;
  dunkel?: boolean;
  onZeigerRunter?: (p: { x: number; y: number }) => void;
  onZeigerHoch?: (p: { x: number; y: number }) => void;
  onHomeLeiste?: () => void;
  onStatusLeiste?: () => void;
  bildschirmRef?: Ref<HTMLDivElement>;
}) {
  const flaeche = useRef<HTMLDivElement | null>(null);
  const anteil = (e: PointerEvent) => {
    const r = flaeche.current?.getBoundingClientRect();
    if (!r || r.width === 0) return { x: 0.5, y: 0.5 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const ios = system === "ios";
  const text = dunkel || schwarz ? "#ffffff" : "#111111";

  return (
    <div className="relative mx-auto select-none" style={{ width: 300, height: 620 }} data-handy={system}>
      {/* Seitentasten */}
      {TASTEN[system].map(t => (
        <button
          key={t.id}
          type="button"
          data-taste={t.id}
          aria-label={t.label}
          title={t.label}
          onClick={() => onTaste?.(t.id)}
          className="absolute rounded-sm transition-colors"
          style={{
            [t.seite === "links" ? "left" : "right"]: 0,
            top: t.oben,
            width: 8,
            height: t.hoehe,
            background: gedrueckt.includes(t.id) ? "#f59e0b" : "#6b7280",
          }}
        />
      ))}
      {/* Gehäuse */}
      <div
        className="absolute rounded-[46px] p-[10px] shadow-2xl"
        style={{ left: 6, right: 6, top: 0, bottom: 0, background: ios ? "#1f2937" : "#111827" }}
      >
        <div
          ref={el => {
            flaeche.current = el;
            if (typeof bildschirmRef === "function") bildschirmRef(el);
            else if (bildschirmRef) (bildschirmRef as { current: HTMLDivElement | null }).current = el;
          }}
          data-bildschirm
          className="relative w-full h-full overflow-hidden rounded-[38px]"
          style={{ background: schwarz ? "#000000" : dunkel ? "#111111" : "#f2f2f7", touchAction: "none" }}
          onPointerDown={e => onZeigerRunter?.(anteil(e))}
          onPointerUp={e => onZeigerHoch?.(anteil(e))}
        >
          {!schwarz && (
            <>
              {/* Statusleiste */}
              <div
                data-statusleiste
                onClick={onStatusLeiste}
                className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-6 text-[13px] font-bold"
                style={{ height: 40, color: text }}
              >
                <span><Uhrzeit /></span>
                <span className="flex items-center gap-1.5" aria-label="Empfang, WLAN, Akku">
                  <span aria-hidden>▂▄▆</span>
                  <span aria-hidden>⌔</span>
                  <span className="inline-block rounded-[3px] border px-[2px] text-[9px] leading-[11px]" style={{ borderColor: text }}>80</span>
                </span>
              </div>
              {/* Kamera: Insel (iPhone) bzw. Loch (Android) */}
              <div
                className="absolute left-1/2 -translate-x-1/2 z-40 bg-black pointer-events-none"
                style={ios ? { top: 10, width: 90, height: 26, borderRadius: 14 } : { top: 13, width: 14, height: 14, borderRadius: 7 }}
              />
            </>
          )}
          <div className="absolute inset-0" style={{ paddingTop: schwarz ? 0 : 40 }}>
            {children}
          </div>
          {!schwarz && (
            <button
              type="button"
              data-homeleiste
              aria-label={ios ? "Home-Leiste" : "Gestenleiste"}
              onClick={onHomeLeiste}
              className="absolute left-1/2 -translate-x-1/2 bottom-1 z-30 flex items-center justify-center"
              style={{ width: 150, height: 22 }}
            >
              <span className="block rounded-full" style={{ width: ios ? 130 : 110, height: 5, background: text, opacity: 0.8 }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export type StartApp = { id: string; name: string; icon: string; farbe: string };

/** Ein App-Symbol: farbige Kachel mit Emoji. Lange drücken (≥ 0,5 s) ruft `onLange`. */
export function AppKachel({ app, system, onTipp, onLange }: {
  app: StartApp; system: HandySystem; onTipp?: () => void; onLange?: () => void;
}) {
  const uhr = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lang = useRef(false);
  useEffect(() => () => { if (uhr.current) clearTimeout(uhr.current); }, []);
  return (
    <button
      type="button"
      data-app-kachel={app.id}
      onPointerDown={e => {
        e.stopPropagation();
        lang.current = false;
        if (onLange) uhr.current = setTimeout(() => { lang.current = true; onLange(); }, 500);
      }}
      onPointerUp={e => { e.stopPropagation(); if (uhr.current) clearTimeout(uhr.current); }}
      onPointerLeave={() => { if (uhr.current) clearTimeout(uhr.current); }}
      onClick={() => { if (!lang.current) onTipp?.(); }}
      onContextMenu={e => e.preventDefault()}
      className="flex flex-col items-center gap-1"
    >
      <span
        className="flex items-center justify-center text-2xl shadow-sm"
        style={{ width: 52, height: 52, borderRadius: system === "ios" ? 13 : 26, background: app.farbe }}
      >
        {app.icon}
      </span>
      <span className="text-[11px] leading-tight max-w-16 truncate">{app.name}</span>
    </button>
  );
}

/** Startbildschirm: Raster aus Apps, unten ein Dock. */
export function Startbildschirm({ system, apps, dock = [], onApp, onLange, dunkel = false }: {
  system: HandySystem; apps: StartApp[]; dock?: StartApp[]; onApp: (id: string) => void; onLange?: (id: string) => void; dunkel?: boolean;
}) {
  return (
    <div
      className="absolute inset-0 flex flex-col"
      style={{ paddingTop: 52, background: system === "ios" ? "linear-gradient(160deg,#7dd3fc,#a78bfa)" : "linear-gradient(170deg,#bbf7d0,#60a5fa)", color: dunkel ? "#fff" : "#111" }}
    >
      <div className="grid grid-cols-4 gap-y-4 px-4">
        {apps.map(a => <AppKachel key={a.id} app={a} system={system} onTipp={() => onApp(a.id)} onLange={onLange ? () => onLange(a.id) : undefined} />)}
      </div>
      <div className="flex-1" />
      {dock.length > 0 && (
        <div className="mx-3 mb-8 rounded-[28px] px-3 py-2 flex justify-around" style={{ background: "#ffffff59" }}>
          {dock.map(a => <AppKachel key={a.id} app={a} system={system} onTipp={() => onApp(a.id)} />)}
        </div>
      )}
    </div>
  );
}

/**
 * Die Einstellungen als Liste. `seite` ist eine Bildschirm-Id aus
 * EINSTELLUNGEN; eine Wahl-Zeile öffnet ihre Optionen als eigene Seite
 * (`offeneWahl`).
 */
export function EinstellListe({
  system, seite, werte, offeneWahl, onSeite, onWahlOeffnen, onWert, onZurueck, onLeer,
}: {
  system: HandySystem;
  seite: string;
  werte: Werte;
  offeneWahl: string | null;
  onSeite: (id: string) => void;
  onWahlOeffnen: (id: string | null) => void;
  onWert: (id: string, wert: Wert) => void;
  onZurueck: () => void;
  /** Ein Menüpunkt ohne Inhalt wurde angetippt. */
  onLeer?: (text: string) => void;
}) {
  const ios = system === "ios";
  const bild = EINSTELLUNGEN[system][seite] ?? EINSTELLUNGEN[system].start;
  const wahl = offeneWahl ? bild.zeilen.find((z): z is Extract<Zeile, { art: "wahl" }> => z.art === "wahl" && z.id === offeneWahl) : undefined;
  const akzent = ios ? "#007aff" : "#1a73e8";

  const kopf = (titel: string, zurueck: boolean, onBack: () => void) => (
    <div className={"flex items-center gap-2 px-3 " + (ios ? "pt-1 pb-2" : "py-3")}>
      {zurueck && (
        <button type="button" data-zurueck onClick={onBack} className="font-bold text-[15px]" style={{ color: ios ? akzent : "#111" }} aria-label="Zurück">
          {ios ? "‹ Zurück" : "←"}
        </button>
      )}
      {!ios && <span className="text-[19px] font-normal">{titel}</span>}
    </div>
  );

  const gruppe = (inhalt: ReactNode) => (
    <div className={ios ? "mx-3 rounded-xl bg-white overflow-hidden divide-y divide-[#e5e5ea]" : "divide-y divide-transparent"}>{inhalt}</div>
  );

  const schalter = (an: boolean) => (
    <span
      className="relative inline-block shrink-0 rounded-full transition-colors"
      style={{ width: 44, height: 26, background: an ? (ios ? "#34c759" : akzent) : "#c7c7cc" }}
      aria-hidden
    >
      <span className="absolute top-[3px] rounded-full bg-white shadow transition-all" style={{ width: 20, height: 20, left: an ? 21 : 3 }} />
    </span>
  );

  if (wahl) {
    return (
      <div className="absolute inset-0 overflow-y-auto pb-10" style={{ paddingTop: 44, background: ios ? "#f2f2f7" : "#ffffff", color: "#111" }} data-einstellungen>
        {kopf(wahl.text, true, () => onWahlOeffnen(null))}
        <div className={ios ? "px-5 pb-2 text-[26px] font-bold" : "px-4 pb-2 text-[15px] text-[#5f6368]"}>{wahl.text}</div>
        {gruppe(wahl.optionen.map(o => {
          const aktiv = werte[wahl.id] === o;
          return (
            <button
              key={o}
              type="button"
              data-option={o}
              role="radio"
              aria-checked={aktiv}
              onClick={() => onWert(wahl.id, o)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left text-[15px]"
            >
              {!ios && (
                <span className="shrink-0 rounded-full border-2 flex items-center justify-center" style={{ width: 20, height: 20, borderColor: aktiv ? akzent : "#5f6368" }}>
                  {aktiv && <span className="rounded-full" style={{ width: 10, height: 10, background: akzent }} />}
                </span>
              )}
              <span className="flex-1">{o}</span>
              {ios && aktiv && <span style={{ color: akzent }} className="font-bold">✓</span>}
            </button>
          );
        }))}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pb-10" style={{ paddingTop: 44, background: ios ? "#f2f2f7" : "#ffffff", color: "#111" }} data-einstellungen data-seite={seite}>
      {kopf(bild.titel, seite !== "start", onZurueck)}
      {ios && <div className="px-5 pb-2 text-[28px] font-bold">{bild.titel}</div>}
      {gruppe(bild.zeilen.map((z, i) => {
        const basis = "w-full flex items-center gap-3 px-4 py-3 text-left text-[15px]";
        if (z.art === "link") {
          return (
            <button key={i} type="button" data-zeile={z.text} onClick={() => (z.ziel ? onSeite(z.ziel) : onLeer?.(z.text))} className={basis}>
              {z.icon && <span className="text-lg w-6 text-center" aria-hidden>{z.icon}</span>}
              <span className="flex-1 min-w-0">
                <span className="block">{z.text}</span>
                {z.unter && <span className="block text-[12px] text-[#5f6368] truncate">{z.unter}</span>}
              </span>
              {ios && <span className="text-[#c7c7cc]">›</span>}
            </button>
          );
        }
        if (z.art === "schalter") {
          const an = werte[z.id] === true;
          return (
            <button key={i} type="button" data-zeile={z.text} role="switch" aria-checked={an} onClick={() => onWert(z.id, !an)} className={basis}>
              <span className="flex-1 min-w-0">
                <span className="block">{z.text}</span>
                {z.unter && <span className="block text-[12px] text-[#5f6368]">{z.unter}</span>}
              </span>
              {schalter(an)}
            </button>
          );
        }
        if (z.art === "wahl") {
          return (
            <button key={i} type="button" data-zeile={z.text} onClick={() => onWahlOeffnen(z.id)} className={basis}>
              <span className="flex-1 min-w-0">
                <span className="block">{z.text}</span>
                {!ios && <span className="block text-[12px] text-[#5f6368]">{String(werte[z.id] ?? "")}</span>}
              </span>
              {ios && <span className="text-[#8e8e93] text-[14px]">{String(werte[z.id] ?? "")} ›</span>}
            </button>
          );
        }
        const erledigt = werte[z.id] === true;
        return (
          <button key={i} type="button" data-zeile={z.text} disabled={erledigt} onClick={() => onWert(z.id, true)} className={basis} style={{ color: erledigt ? "#34a853" : akzent }}>
            {erledigt ? z.danach : z.text}
          </button>
        );
      }))}
    </div>
  );
}

/** Gemeinsamer Rahmen jeder Mobil-Stufe. */
export function MobilRahmen({
  titel, auftrag, punkte, onDemo, onWeiter, fertig, avatar, aufgaben, schritt, hinweis, handy, seitenleiste,
}: {
  titel: string;
  auftrag: ReactNode;
  punkte: number;
  onDemo?: () => void;
  onWeiter: () => void;
  fertig: boolean;
  avatar: string;
  aufgaben: string[];
  schritt: number;
  hinweis: Hinweis | null;
  handy: ReactNode;
  /** Zusätzlicher Inhalt rechts unter den Aufgaben (Erklärungen, Antworten). */
  seitenleiste?: ReactNode;
}) {
  const { handy: system, setHandy, pruefung } = useMausKontext();
  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf titel={titel} auftrag={auftrag} punkte={punkte} onDemo={fertig ? undefined : onDemo} onWeiter={onWeiter} hervor={fertig}>
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>
      <div className="grid gap-6 md:grid-cols-[320px_1fr] items-start">
        {handy}
        <aside className="flex flex-col gap-3">
          {!pruefung && (
            <div className="flex gap-1 rounded-xl border border-line p-1 w-fit" role="group" aria-label="Handy wählen">
              {(["android", "ios"] as const).map(h => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={system === h}
                  onClick={() => setHandy(h)}
                  className={"text-sm rounded-lg px-3 py-1 " + (system === h ? "bg-accent text-page font-bold" : "hover:bg-surface-hover")}
                >
                  {h === "android" ? "🤖" : "🍎"} {HANDY_NAME[h]}
                </button>
              ))}
            </div>
          )}
          <div className="card p-4 flex flex-col gap-2">
            <h3 className="font-black">Aufgaben</h3>
            <ul className="flex flex-col gap-1.5">
              {aufgaben.map((a, i) => (
                <li key={i} className={"text-sm flex gap-2 " + (i === schritt ? "font-bold" : i < schritt ? "text-muted" : "")}>
                  <span>{i < schritt ? "✅" : i === schritt ? "👉" : "⬜"}</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
            <Hinweiszeile hinweis={hinweis} />
          </div>
          {seitenleiste}
        </aside>
      </div>
    </div>
  );
}

/** Zustand der nachgebauten Einstellungen: Werte, aufgerufene Seiten, offene Wahl. */
export function useHandyEinstellungen(system: HandySystem) {
  const [werte, setWerte] = useState<Werte>(START_WERTE[system]);
  const [verlauf, setVerlauf] = useState<string[]>(["start"]);
  const [wahl, setWahl] = useState<string | null>(null);
  return {
    werte, setWerte, wahl, setWahl, verlauf, setVerlauf,
    seite: verlauf[verlauf.length - 1],
    oeffne: (id: string) => setVerlauf(v => [...v, id]),
    zurueck: () => setVerlauf(v => (v.length > 1 ? v.slice(0, -1) : v)),
    zurStart: () => { setVerlauf(["start"]); setWahl(null); },
  };
}

/** Vorführung: den Weg einer Einstellungs-Aufgabe Zeile für Zeile zeigen (Navigation, nichts verstellen). */
export function einstellDemo(
  system: HandySystem, aufgabe: EinstellAufgabe, wurzel: () => Element | null, oeffne: (id: string) => void, zurStart: () => void,
): DemoSchritt[] {
  // Erst zeigen und klicken; die Seite wechselt in einem eigenen kurzen Schritt
  // (der Zielort wird vor der Nebenwirkung ausgewertet).
  const schritte: DemoSchritt[] = [{ text: "Zuerst ganz an den Anfang der Einstellungen.", aktion: zurStart, ms: 1200 }];
  for (let i = 0; i + 1 < aufgabe.pfad.length; i++) {
    const zeile = EINSTELLUNGEN[system][aufgabe.pfad[i]].zeilen.find(z => z.art === "link" && z.ziel === aufgabe.pfad[i + 1]);
    if (!zeile) continue;
    const ziel = aufgabe.pfad[i + 1];
    schritte.push(
      { text: `Auf »${zeile.text}« tippen.`, zu: () => mitte(wurzel()?.querySelector(`[data-zeile="${zeile.text}"]`) ?? null), taste: "links" },
      { text: "…", aktion: () => oeffne(ziel), ms: 700 },
    );
  }
  schritte.push({ text: `Hier stellst du es ein: ${aufgabe.weg.split("›").pop()?.trim()}`, taste: null });
  return schritte;
}
