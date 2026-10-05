"use client";
/**
 * Stufe »Profil & Sperrbildschirm«: Profilbild wählen, Sperrbildschirm-Bild
 * und Begrüßung ändern, dann den Computer sperren und wieder anmelden.
 *
 * Die Anmeldung kommt ohne Passwortfeld aus — Kinder sollen in einer Übung
 * nie ein echtes Passwort eintippen.
 */
import { useEffect, useRef, useState } from "react";
import { Stufenkopf } from "./Stufenkopf";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";
import { useMausKontext } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { Einstellungen } from "./windows/Einstellungen";
import { Startmenue } from "./windows/Startmenue";
import { Sperrbildschirm } from "./windows/Sperrbildschirm";
import { APPS, HINTERGRUENDE, akzentFarbe, type Aussehen, type EinstellungId, type Treffer } from "@/lib/maus/windows";
import { begruessungGeaendert, zielProfilTier } from "@/lib/maus/einstellungen";
import { startAngeheftet } from "@/lib/maus/taskleiste";
import { TIERNAMEN, tierName } from "@/lib/maus/tiere";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";

const ANZAHL_AUFGABEN = 4;
const AUFGABEN = ["Profilbild", "Sperrbild", "Begrüßung", "Sperren & anmelden"];

export default function StufeProfil({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, setAussehen, benutzer } = useWindows();

  const start = useRef(performance.now());
  const startAussehen = useRef<Aussehen>(aussehen);
  const zielTier = useRef(zielProfilTier(startAussehen.current, avatar, Object.keys(TIERNAMEN)));

  const [schritt, setSchritt] = useState(0);
  const [fehler, setFehler] = useState(0);
  const [fensterOffen, setFensterOffen] = useState(false);
  const [startOffen, setStartOffen] = useState(false);
  const [suchText, setSuchText] = useState("");
  const [gesperrt, setGesperrt] = useState(false);
  const [seite, setSeite] = useState<EinstellungId>("konto");
  const [hinweis, setHinweis] = useState<{ text: string; gut: boolean } | null>(null);
  const gemeldet = useRef(false);
  const wechselt = useRef(false);
  const rahmenRef = useRef<HTMLDivElement>(null);
  const einstellungenRef = useRef<HTMLDivElement>(null);

  const vorDemo = useRef<{ aussehen: Aussehen; fensterOffen: boolean; startOffen: boolean; seite: EinstellungId; gesperrt: boolean } | null>(null);
  const demo = useDemo(() => {
    if (!vorDemo.current) return;
    setAussehen(vorDemo.current.aussehen);
    setFensterOffen(vorDemo.current.fensterOffen);
    setStartOffen(vorDemo.current.startOffen);
    setSeite(vorDemo.current.seite);
    setGesperrt(vorDemo.current.gesperrt);
    vorDemo.current = null;
  });

  const fertig = schritt >= ANZAHL_AUFGABEN;

  useEffect(() => {
    if (fertig && !gemeldet.current) {
      gemeldet.current = true;
      const dauerMs = Math.round(performance.now() - start.current);
      const { punkte, details } = wertung({ stufe: "profil", geloest: ANZAHL_AUFGABEN, anzahl: ANZAHL_AUFGABEN, dauerMs, fehler });
      onFertig({ punkte, dauerMs, details });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fertig]);

  function weiterMit(gut: boolean, text: string) {
    if (wechselt.current) return;
    setHinweis({ text, gut });
    if (!gut) return;
    wechselt.current = true;
    setTimeout(() => { setHinweis(null); setSchritt(s => s + 1); wechselt.current = false; }, 700);
  }

  function aufAuswahl(feld: keyof Aussehen, wert: unknown) {
    if (demo.aktiv || fertig || wechselt.current) return;
    if (schritt === 0 && feld === "profilTier") {
      if (wert === zielTier.current) weiterMit(true, `Schön — ${tierName(zielTier.current)} ist jetzt dein Profilbild!`);
      else { setFehler(f => f + 1); weiterMit(false, `Das ist ${tierName(String(wert))}. Gesucht ist: ${tierName(zielTier.current)}.`); }
    } else if (schritt === 1 && feld === "sperrBild") {
      if (wert !== startAussehen.current.sperrBild) weiterMit(true, "Neues Bild für den Sperrbildschirm!");
      else weiterMit(false, "Das ist noch das alte Bild — nimm ein anderes.");
    }
  }

  // Die Begrüßung zählt erst, wenn das Kind fertig getippt hat: Feld verlassen oder Enter.
  function begruessungFertig() {
    if (demo.aktiv || fertig || schritt !== 2 || wechselt.current) return;
    if (begruessungGeaendert(aussehen, startAussehen.current)) weiterMit(true, `»${aussehen.begruessung}« — so begrüßt dich dein Computer!`);
    else weiterMit(false, "Schreib erst eine neue Begrüßung in das Feld.");
  }

  function einstellungenOeffnen(ziel?: EinstellungId) {
    if (demo.aktiv) return;
    setFensterOffen(true);
    setSeite(ziel ?? (schritt === 0 ? "konto" : "sperrbildschirm"));
    setStartOffen(false);
  }

  function startTreffer(t: Treffer) {
    if (t.art === "einstellung") einstellungenOeffnen(t.id);
    else if (t.art === "app" && t.id === "einstellungen") einstellungenOeffnen();
    else setHinweis({ text: "Heute brauchst du nur die Einstellungen und dein Profil unten im Startmenü.", gut: false });
  }

  function sperren() {
    if (demo.aktiv) return;
    setStartOffen(false);
    setGesperrt(true);
  }

  function entsperrt() {
    if (demo.aktiv) return;
    setGesperrt(false);
    if (schritt === 3 && !fertig) weiterMit(true, "Willkommen zurück — gesperrt und wieder angemeldet!");
  }

  const andereSperrbilder = HINTERGRUENDE.filter(h => h.id !== startAussehen.current.sperrBild);
  const aufgabenTexte = [
    <>Mach <b>»{tierName(zielTier.current)}«</b> zu deinem Profilbild.
      <span data-zusatz className="block text-xs text-(--text-muted)">Tipp: Einstellungen › Konten › Profilbild.</span></>,
    <>Such dir ein <b>neues Bild für den Sperrbildschirm</b> aus.
      <span data-zusatz className="block text-xs text-(--text-muted)">Tipp: Einstellungen › Sperrbildschirm.</span></>,
    <>Schreib eine <b>Begrüßung</b> für deinen Sperrbildschirm und drücke Enter.</>,
    <><b>Sperre den Computer</b> und melde dich wieder an.
      <span data-zusatz className="block text-xs text-(--text-muted)">Tipp: Start › auf deinen Namen klicken › Sperren.</span></>,
  ];

  // Vorführen zeigt nur — gelöst wird keine Aufgabe, danach steht alles wie vorher.
  function vorfuehren() {
    vorDemo.current = { aussehen, fensterOffen, startOffen, seite, gesperrt };
    const inEinstellungen = (sel: string) => () => mitte(einstellungenRef.current?.querySelector(sel) ?? null);
    const schritte: DemoSchritt[] = [];
    const seiteZeigen = (ziel: EinstellungId, name: string) => {
      if (!fensterOffen) {
        schritte.push({ text: "Öffne die Einstellungen in der Taskleiste.", zu: () => mitte(rahmenRef.current?.querySelector('[data-taskleiste="einstellungen"]') ?? null), taste: "links", aktion: () => { setStartOffen(false); setFensterOffen(true); } });
      }
      schritte.push({ text: `Links auf »${name}« klicken.`, zu: inEinstellungen(`[data-einstellung-nav="${ziel}"]`), taste: "links", aktion: () => setSeite(ziel) });
    };
    if (schritt === 0) {
      seiteZeigen("konto", "Profilbild");
      schritte.push({ text: `Klicke auf: ${tierName(zielTier.current)}.`, zu: inEinstellungen(`[title="${zielTier.current}"]`), taste: "links" });
    } else if (schritt === 1) {
      seiteZeigen("sperrbildschirm", "Sperrbildschirm");
      schritte.push({ text: "Klicke auf ein anderes Bild.", zu: inEinstellungen(`[data-sperrbild="${andereSperrbilder[0].id}"]`), taste: "links" });
    } else if (schritt === 2) {
      seiteZeigen("sperrbildschirm", "Sperrbildschirm");
      schritte.push(
        { text: "Klicke in das Feld »Begrüßung«.", zu: inEinstellungen('input[type="text"]'), taste: "links" },
        { text: "Tippe z. B. »Hallo!« und drücke Enter.", tasten: ["Enter"] },
      );
    } else if (schritt === 3) {
      schritte.push(
        { text: "Klicke auf Start.", zu: () => mitte(rahmenRef.current?.querySelector("[data-start]") ?? null), taste: "links", aktion: () => { setFensterOffen(false); setSuchText(""); setStartOffen(true); } },
        { text: "Klicke unten auf deinen Namen — dann auf »Sperren«.", zu: () => mitte(rahmenRef.current?.querySelector("[data-startmenue] > div:last-child > button") ?? null), taste: "links" },
        { text: "Der Sperrbildschirm! Ein Klick holt die Anmeldung, dann »Anmelden«.", taste: "links", aktion: () => { setStartOffen(false); setGesperrt(true); } },
      );
    }
    schritte.push({ text: "Jetzt bist du dran!", taste: null });
    demo.abspielen(schritte);
  }

  return (
    <div className="flex flex-col gap-3">
      <Stufenkopf
        titel="🔒 Teil 3 · Profil & Sperrbildschirm"
        auftrag={fertig ? <>Klasse — das ist jetzt wirklich dein Computer!</> : aufgabenTexte[schritt]}
        punkte={wertung({
          stufe: "profil", geloest: Math.min(schritt, ANZAHL_AUFGABEN), anzahl: ANZAHL_AUFGABEN,
          dauerMs: performance.now() - start.current, fehler,
        }).punkte}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      />

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {AUFGABEN.map((a, i) => (
          <li key={a} className={i === schritt ? "font-bold" : i < schritt ? "text-(--text-muted)" : ""}>
            {i < schritt ? "✅" : i === schritt ? "👉" : "⬜"} {a}
          </li>
        ))}
      </ul>

      <div className="min-h-6 text-center text-sm font-bold" aria-live="polite"
        style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
        {hinweis?.text}
      </div>

      <WindowsDesktop
        aussehen={aussehen}
        offen={fensterOffen ? ["einstellungen"] : []}
        aktiv={fensterOffen ? "einstellungen" : null}
        onSymbol={id => { if (id === "einstellungen") einstellungenOeffnen(); }}
        onTaskleiste={id => {
          if (id === "einstellungen") (fensterOffen ? setFensterOffen(false) : einstellungenOeffnen());
        }}
        onStart={() => { setSuchText(""); setStartOffen(o => !o); }}
        onSuche={() => setStartOffen(true)}
        startOffen={startOffen}
        rahmenRef={rahmenRef}
        overlay={<>
          {startOffen && (
            <Startmenue
              suchText={suchText}
              onSuchText={setSuchText}
              angeheftet={startAngeheftet(null)}
              onApp={id => startTreffer({ art: "app", id, name: APPS[id].name })}
              onTreffer={startTreffer}
              benutzer={benutzer}
              profilTier={aussehen.profilTier}
              onSperren={sperren}
              dunkel={aussehen.dunkel}
              akzent={akzentFarbe(aussehen.akzent)}
              hilfe={hilfe}
              onSchliessen={() => setStartOffen(false)}
            />
          )}
          {gesperrt && <Sperrbildschirm aussehen={aussehen} benutzer={benutzer} onEntsperrt={entsperrt} hilfe={hilfe} />}
        </>}
      >
        {fensterOffen && (
          <div
            ref={einstellungenRef}
            className="pointer-events-auto absolute rounded-xl shadow-xl overflow-hidden flex flex-col"
            style={{ left: "8%", top: "6%", width: "84%", height: "80%", background: aussehen.dunkel ? "#202020" : "#f3f3f3" }}
            onBlur={e => { if ((e.target as HTMLElement).matches('input[type="text"]')) begruessungFertig(); }}
            onKeyDown={e => { if (e.key === "Enter" && (e.target as HTMLElement).matches('input[type="text"]')) begruessungFertig(); }}
          >
            <div className="flex items-center gap-2 px-2 shrink-0" style={{ height: 32, background: aussehen.dunkel ? "#2b2b2b" : "#ffffff", borderBottom: `1px solid ${aussehen.dunkel ? "#ffffff1a" : "#0000001a"}` }}>
              <AppSymbol id="einstellungen" groesse={18} titel={false} />
              <span className="text-sm font-bold flex-1" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>Einstellungen</span>
              <button type="button" onClick={() => setFensterOffen(false)} aria-label="Schließen" className="rounded-sm hover:bg-red-500 hover:text-white w-6 h-6" style={{ color: aussehen.dunkel ? "#fff" : "#1a1a1a" }}>✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <Einstellungen
                aussehen={aussehen}
                onAussehen={setAussehen}
                seite={seite}
                onSeite={setSeite}
                benutzer={benutzer}
                hilfe={hilfe}
                onAuswahl={aufAuswahl}
              />
            </div>
          </div>
        )}
      </WindowsDesktop>

      <DemoBuehne demo={demo} />
    </div>
  );
}
