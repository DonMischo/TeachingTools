"use client";
/**
 * Teil 2, Stufe »Speichern & USB-Stick«: im Editor schreiben, speichern,
 * wiederfinden, auf den USB-Stick bringen — und den Computer ausschalten.
 *
 * Sieben Aufgaben am selben Windows-Bildschirm, jede baut auf der vorigen
 * auf: (1) etwas schreiben, (2) Datei › Speichern unter, (3) weiterschreiben
 * und beim Schließen speichern, (4) die Datei im Explorer wieder öffnen,
 * (5) den eingesteckten USB-Stick in der Seitenleiste finden, (6) die Datei
 * auf den Stick ziehen, (7) herunterfahren.
 *
 * Wie in Windows fragt der Editor beim Schließen nur, wenn sich seit dem
 * letzten Speichern etwas geändert hat — ohne Änderung geht er einfach zu.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AvatarDisplay } from "@/components/AvatarPicker";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { wertung } from "@/lib/maus/wertung";
import { USB, ablegen, baueDateisystem, neueDatei, usbFuer, type Dateisystem, type Knoten } from "@/lib/maus/dateisystem";
import { appName, type Betriebssystem } from "@/lib/maus/system";
import { uebersetzer, uebertrage } from "./systemText";
import { akzentFarbe, type AppId } from "@/lib/maus/windows";
import { useMausKontext, HILFE_GROESSE } from "./MausKontext";
import { useWindows } from "./windows/WindowsKontext";
import { WindowsDesktop } from "./windows/WindowsDesktop";
import { AppSymbol } from "./windows/AppSymbol";
import { ExplorerInhalt } from "./windows/ExplorerInhalt";
import { SpeichernUnter } from "./windows/SpeichernUnter";
import { Startmenue, type EinAus } from "./windows/Startmenue";
import { FensterKnoepfe, KnopfImText, useKnoepfeLinks } from "./windows/FensterSymbol";
import { OrdnerSymbol } from "./windows/OrdnerSymbol";
import { Stufenkopf } from "./Stufenkopf";
import { mitTasten } from "./Taste";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "./Demo";

type AufgabeId = "schreiben" | "speichernUnter" | "schliessen" | "wiederfinden" | "usbFinden" | "aufStick" | "herunterfahren";

const Sym = ({ id }: { id: AppId }) => (
  <span className="inline-flex align-middle mx-0.5"><AppSymbol id={id} groesse={20} titel={false} /></span>
);
const UsbSym = () => <span className="inline-flex align-middle mx-0.5"><OrdnerSymbol knoten={USB} groesse={20} /></span>;
// (Das Symbol ist überall gleich; nur der Name wechselt mit dem System.)

const AUFGABEN: { id: AufgabeId; kurz: string; titel: ReactNode; schritte: ReactNode[] }[] = [
  {
    id: "schreiben", kurz: "Schreiben",
    titel: <>Schreib in den Editor einen Satz über dein Lieblingstier — mindestens drei Wörter.</>,
    schritte: [<>In das weiße Feld des Editors klicken.</>, <>Lostippen, z. B. »Mein Hund heißt Bello.«</>],
  },
  {
    id: "speichernUnter", kurz: "Speichern unter",
    titel: <>Speichere deinen Text mit <b>Datei › Speichern unter …</b> in »Dokumente«.</>,
    schritte: [
      <>Oben im Editor auf <b>Datei</b> klicken, dann auf <b>Speichern unter …</b></>,
      <>Links »Dokumente« wählen (ist meist schon gewählt).</>,
      <>Bei »Dateiname« einen eigenen Namen eintippen, z. B. »Mein Tier« — nicht »Unbenannt«.</>,
      <>Auf <b>Speichern</b> klicken. Oben im Fenster steht jetzt dein Dateiname.</>,
    ],
  },
  {
    id: "schliessen", kurz: "Beim Schließen speichern",
    titel: <>Schreib noch einen Satz dazu — und schließ dann den Editor. Er fragt, ob er speichern soll.</>,
    schritte: [
      <>Einen zweiten Satz anhängen. Vor dem Namen oben erscheint ein Sternchen *: es gibt Ungespeichertes.</>,
      <>Oben rechts auf <KnopfImText art="schliessen" /> klicken.</>,
      <>In der Frage <b>Speichern</b> wählen. (»Nicht speichern« wirft den neuen Satz weg.)</>,
      <>Ohne Änderung fragt der Editor nicht — dann geht er einfach zu.</>,
    ],
  },
  {
    id: "wiederfinden", kurz: "Wiederfinden",
    titel: <>Öffne deine Datei wieder — über den Explorer.</>,
    schritte: [
      <>Explorer öffnen: Doppelklick auf <Sym id="dieserpc" /> »Dieser PC« oder Klick auf <Sym id="explorer" /> in der Taskleiste.</>,
      <>Links in der Seitenleiste auf »Dokumente« klicken.</>,
      <>Deine Datei doppelklicken — der Editor zeigt beide Sätze.</>,
    ],
  },
  {
    id: "usbFinden", kurz: "USB-Stick finden",
    titel: <>Ein USB-Stick wurde eingesteckt. Finde ihn im Explorer in der <b>Seitenleiste</b>.</>,
    schritte: [
      <>Explorer öffnen (falls er zu ist).</>,
      <>Links in der Seitenleiste, unter »Dieser PC«, steht <UsbSym /> <b>USB-Stick (D:)</b>.</>,
      <>Einmal darauf klicken — rechts siehst du, was auf dem Stick ist.</>,
    ],
  },
  {
    id: "aufStick", kurz: "Datei auf den Stick",
    titel: <>Bring deine Datei auf den USB-Stick: zieh sie aus »Dokumente« auf <UsbSym /> »USB-Stick (D:)« in der Seitenleiste.</>,
    schritte: [
      <>Im Explorer »Dokumente« öffnen.</>,
      <>Deine Datei mit gedrückter linker Maustaste greifen …</>,
      <>… links auf »USB-Stick (D:)« ziehen und dort loslassen.</>,
      <>Auf einen anderen Datenträger wird <b>kopiert</b>: die Datei bleibt auch in »Dokumente«.</>,
    ],
  },
  {
    id: "herunterfahren", kurz: "Herunterfahren",
    titel: <>Fahre den Computer herunter.</>,
    schritte: [
      <>Unten auf <b>Start</b> klicken (das Fenster-Logo).</>,
      <>Im Startmenü unten rechts auf den <b>Ein/Aus-Knopf ⏻</b> klicken.</>,
      <><b>Herunterfahren</b> wählen. (»Energie sparen« lässt ihn nur schlafen.)</>,
    ],
  },
];

/** Für Ubuntu/macOS: Windows-Begriffe ersetzen (systemText.tsx); am Mac heißt das »Datei«-Menü »Ablage«. */
function uebersetzerDatei(system: Betriebssystem): (t: string) => string {
  const allgemein = uebersetzer(system);
  if (system !== "macos") return allgemein;
  return t => allgemein(t === "Datei" ? "Ablage" : t.replaceAll("»Datei«", "»Ablage«").replace(/^Datei ›/, "Ablage ›"));
}

/** Ausschalten bei Ubuntu (⏻ oben rechts) und macOS (● oben links) statt über das Startmenü. */
const HERUNTERFAHREN: Record<Exclude<Betriebssystem, "windows">, ReactNode[]> = {
  ubuntu: [
    <>Oben rechts in der Leiste auf <b>⏻</b> klicken.</>,
    <><b>Ausschalten …</b> wählen. (»Bildschirm sperren« schaltet nicht aus.)</>,
  ],
  macos: [
    <>Oben links in der Menüleiste auf <b>●</b> (das System-Menü) klicken.</>,
    <><b>Ausschalten …</b> wählen. (»Ruhezustand« lässt ihn nur schlafen.)</>,
  ],
};

const BEISPIEL_INHALT: Record<string, string> = {
  "f-einkauf": "Milch\nBrot\nÄpfel\nKäse",
};

type Editor = { offen: boolean; datei: string | null; text: string; gespeichert: string };
type Dialog = "frage" | "speichernUnter" | null;
type Hinweis = { text: string; gut: boolean } | null;

function woerter(text: string): number {
  return text.trim().split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}

export default function StufeDatei({
  avatar, onFertig, onWeiter,
}: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { hilfe } = useMausKontext();
  const { aussehen, benutzer, system, sys } = useWindows();
  const t = uebersetzerDatei(system);
  const links = useKnoepfeLinks();
  const usb = usbFuer(system);
  const [sysMenue, setSysMenue] = useState(false);
  const [nr, setNr] = useState(0);
  const [hinweis, setHinweis] = useState<Hinweis>(null);
  const [fs, setFs] = useState<Dateisystem>(() => baueDateisystem(benutzer, false, system));
  const [inhalte, setInhalte] = useState<Record<string, string>>(BEISPIEL_INHALT);
  const [editor, setEditor] = useState<Editor>({ offen: true, datei: null, text: "", gespeichert: "" });
  const [dateiMenue, setDateiMenue] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [explorer, setExplorer] = useState<{ offen: boolean; ordner: string; markiert: string | null }>({ offen: false, ordner: "pc", markiert: null });
  const [aktiv, setAktiv] = useState<AppId | null>("editor");
  const [startOffen, setStartOffen] = useState(false);
  const [einAusDemo, setEinAusDemo] = useState<boolean | undefined>(undefined);
  const [aus, setAus] = useState<"faehrt" | "aus" | null>(null);
  const [usbMeldung, setUsbMeldung] = useState(false);
  const meineDatei = useRef<string | null>(null);
  /** Die Kopie der eigenen Datei auf dem Stick — auch wenn sie schon vor ihrer Aufgabe dort landet. */
  const stickKopie = useRef<string | null>(null);
  const nachSpeichernSchliessen = useRef(false);
  const wartet = useRef(false);
  const start = useRef(performance.now());
  const fehler = useRef(0);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const dateiKnopf = useRef<HTMLButtonElement>(null);
  const schliessenKnopf = useRef<HTMLButtonElement>(null);
  const demoLaeuft = useRef(false);
  const vorDemo = useRef<{
    fs: Dateisystem; inhalte: Record<string, string>; editor: Editor; dialog: Dialog;
    explorer: typeof explorer; aktiv: AppId | null; startOffen: boolean;
  } | null>(null);
  const demo = useDemo(() => {
    demoLaeuft.current = false;
    const v = vorDemo.current;
    if (v) {
      setFs(v.fs); setInhalte(v.inhalte); setEditor(v.editor); setDialog(v.dialog);
      setExplorer(v.explorer); setAktiv(v.aktiv); setStartOffen(v.startOffen);
    }
    setDateiMenue(false);
    setEinAusDemo(undefined);
    vorDemo.current = null;
  });

  const fertig = nr >= AUFGABEN.length;
  const roh = AUFGABEN[Math.min(nr, AUFGABEN.length - 1)];
  const aufgabe = {
    ...roh,
    titel: uebertrage(roh.titel, t),
    schritte: system !== "windows" && roh.id === "herunterfahren" ? HERUNTERFAHREN[system] : roh.schritte.map(x => uebertrage(x, t)),
  };
  const geaendert = editor.text !== editor.gespeichert;
  const dateiName = editor.datei ? fs[editor.datei]?.name ?? "Unbenannt" : "Unbenannt";

  function fehlversuch(text: string) {
    fehler.current += 1;
    setHinweis({ text, gut: false });
  }

  function geschafft(id: AufgabeId, text: string) {
    if (demoLaeuft.current || aufgabe.id !== id || fertig || wartet.current) return;
    wartet.current = true;
    setHinweis({ text, gut: true });
    const naechste = nr + 1;
    setTimeout(() => {
      wartet.current = false;
      setHinweis(null);
      setNr(naechste);
      if (naechste === AUFGABEN.length) {
        const dauerMs = Math.round(performance.now() - start.current);
        const w = wertung({ stufe: "datei", geloest: naechste, anzahl: AUFGABEN.length, dauerMs, fehler: fehler.current });
        onFertig({ punkte: w.punkte, dauerMs, details: [...w.details, "Gespeichert, wiedergefunden, auf den Stick gebracht"] });
      }
    }, 1100);
  }

  // Der USB-Stick wird erst zur passenden Aufgabe »eingesteckt«.
  useEffect(() => {
    if (aufgabe.id !== "usbFinden" || fs.usb) return;
    const uhr = setTimeout(() => {
      setFs(f => ({ ...f, usb }));
      setUsbMeldung(true);
    }, 700);
    return () => clearTimeout(uhr);
  }, [aufgabe.id, fs.usb]);

  // Wer die Datei schon beim Suchen auf den Stick gezogen hat, ist mit »aufStick« gleich fertig.
  useEffect(() => {
    if (aufgabe.id === "aufStick" && stickKopie.current && fs[stickKopie.current]) {
      geschafft("aufStick", "Deine Datei ist schon auf dem Stick — und auch noch in »Dokumente«.");
    }
  }, [aufgabe.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!usbMeldung) return;
    const uhr = setTimeout(() => setUsbMeldung(false), 6000);
    return () => clearTimeout(uhr);
  }, [usbMeldung]);

  // ── Editor ──────────────────────────────────────────────────────────
  function tippen(text: string) {
    setEditor(e => ({ ...e, text }));
    if (woerter(text) >= 3) geschafft("schreiben", "Toll geschrieben!");
  }

  function editorOeffnen(datei: string | null) {
    const text = datei ? inhalte[datei] ?? "" : "";
    setEditor({ offen: true, datei, text, gespeichert: text });
    setAktiv("editor");
  }

  function editorZu() {
    setEditor(e => ({ ...e, offen: false }));
    setDateiMenue(false);
    setAktiv(explorer.offen ? "explorer" : null);
  }

  /** Speichern in die schon benannte Datei. */
  function inDateiSpeichern(): boolean {
    if (!editor.datei) return false;
    const id = editor.datei;
    setInhalte(i => ({ ...i, [id]: editor.text }));
    setEditor(e => ({ ...e, gespeichert: e.text }));
    return true;
  }

  function speichern() {
    setDateiMenue(false);
    if (inDateiSpeichern()) setHinweis({ text: `»${dateiName}« gespeichert.`, gut: true });
    else setDialog("speichernUnter");
  }

  function speichernUnterOeffnen() {
    setDateiMenue(false);
    nachSpeichernSchliessen.current = false;
    setDialog("speichernUnter");
  }

  function speichernUnterFertig(ordnerId: string, name: string) {
    if (name.toLowerCase() === "unbenannt.txt") {
      fehlversuch("Nimm lieber einen eigenen Namen, zum Beispiel »Mein Tier« — nicht »Unbenannt«.");
      return;
    }
    const { fs: neuFs, id } = neueDatei(fs, ordnerId, name, "editor");
    setFs(neuFs);
    setInhalte(i => ({ ...i, [id]: editor.text }));
    setEditor(e => ({ ...e, datei: id, gespeichert: e.text }));
    setDialog(null);
    if (!meineDatei.current || aufgabe.id === "speichernUnter") meineDatei.current = id;
    if (nachSpeichernSchliessen.current) {
      nachSpeichernSchliessen.current = false;
      editorZu();
    }
    geschafft("speichernUnter", `Gespeichert als »${name}«!`);
  }

  function schliessenKlick() {
    if (demo.aktiv) return;
    if (geaendert) {
      setDateiMenue(false);
      setDialog("frage");
      return;
    }
    editorZu();
    if (aufgabe.id === "schliessen") {
      setHinweis({
        text: "Zu — ohne Frage, denn es gab nichts Neues zu speichern. Öffne den Editor über die Taskleiste wieder und schreib erst etwas dazu.",
        gut: false,
      });
    }
  }

  function frageAntwort(wahl: "speichern" | "nicht" | "abbrechen") {
    setDialog(null);
    if (wahl === "abbrechen") {
      setHinweis({ text: "Abgebrochen — der Editor bleibt offen.", gut: false });
      return;
    }
    if (wahl === "nicht") {
      editorZu();
      fehlversuch("Nicht gespeichert — das Neue ist jetzt weg. Öffne die Datei wieder und versuch es noch einmal.");
      return;
    }
    if (inDateiSpeichern()) {
      editorZu();
      geschafft("schliessen", "Gespeichert und geschlossen!");
    } else {
      nachSpeichernSchliessen.current = true;
      setDialog("speichernUnter");
    }
  }

  function tasteImEditor(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) speichernUnterOeffnen();
      else speichern();
    }
  }

  // ── Explorer ────────────────────────────────────────────────────────
  function explorerOeffnen() {
    if (demo.aktiv) return;
    setExplorer(x => (x.offen ? x : { offen: true, ordner: "pc", markiert: null }));
    setAktiv("explorer");
  }

  function ordnerWechsel(id: string) {
    if (fs[id]?.gesperrt) fehler.current += 1;
    setExplorer(x => ({ ...x, ordner: id, markiert: null }));
    if (id === "usb") geschafft("usbFinden", system === "windows" ? "Da ist der USB-Stick: Laufwerk D:!" : "Da ist der USB-Stick!");
  }

  function dateiOeffnen(k: Knoten) {
    if (k.app !== "editor") {
      setHinweis({ text: `»${k.name}« öffnet ein anderes Programm — hier geht es um deine Textdatei.`, gut: false });
      return;
    }
    editorOeffnen(k.id);
    if (aufgabe.id !== "wiederfinden") return;
    if (k.id === meineDatei.current) geschafft("wiederfinden", "Wiedergefunden — beide Sätze sind da!");
    else fehlversuch("Das ist nicht deine Datei — schau noch einmal in »Dokumente«.");
  }

  function abgelegt(dateiId: string, zielId: string) {
    const r = ablegen(fs, dateiId, zielId);
    const name = fs[dateiId]?.name ?? "";
    if (!r) {
      if (fs[zielId] && fs[dateiId]?.eltern !== zielId) {
        setHinweis({ text: `»${name}« liegt dort schon — oder dort darf nichts hin.`, gut: false });
      }
      return;
    }
    setFs(r.fs);
    if (r.kopiert) setInhalte(i => ({ ...i, [r.id]: i[dateiId] ?? "" }));
    if (zielId === "usb" && dateiId === meineDatei.current) {
      stickKopie.current = r.id;
      if (aufgabe.id === "usbFinden") geschafft("usbFinden", "Stick gefunden — und deine Datei gleich draufkopiert!");
      else geschafft("aufStick", "Kopiert! Deine Datei ist jetzt auf dem Stick — und auch noch in »Dokumente«.");
    } else if (zielId === "usb") {
      setHinweis({ text: `»${name}« ist jetzt auch auf dem Stick. Zieh noch deine eigene Datei hinüber.`, gut: false });
    } else {
      setHinweis({ text: `»${name}« ${r.kopiert ? "kopiert" : "verschoben"} nach »${fs[zielId]?.name}«.`, gut: false });
    }
  }

  /** Eigene Dateien (gespeichert oder kopiert) dürfen weg, vorhandene nicht. */
  function loeschen(k: Knoten) {
    if (!k.id.startsWith("neu-")) {
      setHinweis({ text: `»${k.name}« hast nicht du angelegt — fremde Dateien löscht man nicht einfach. Lösch nur, was du selbst gespeichert oder kopiert hast.`, gut: false });
      return;
    }
    if (k.id === meineDatei.current) {
      setHinweis({ text: `»${k.name}« in »Dokumente« ist deine Datei — die brauchst du noch.`, gut: false });
      return;
    }
    entfernen([k.id]);
    setHinweis({ text: `»${k.name}« gelöscht.`, gut: false });
  }

  function entfernen(ids: string[]) {
    setFs(f => Object.fromEntries(Object.entries(f).filter(([id]) => !ids.includes(id))));
    setInhalte(i => Object.fromEntries(Object.entries(i).filter(([id]) => !ids.includes(id))));
    if (stickKopie.current && ids.includes(stickKopie.current)) stickKopie.current = null;
    if (editor.datei && ids.includes(editor.datei)) editorZu();
    setExplorer(x => ({ ...x, markiert: null }));
  }

  /** Stick leeren und neu anfangen, wenn beim Ziehen etwas schiefging. */
  function stickZuruecksetzen() {
    entfernen(Object.values(fs).filter(k => k.eltern === "usb").map(k => k.id));
    setExplorer({ offen: true, ordner: aufgabe.id === "aufStick" ? "dokumente" : "pc", markiert: null });
    setAktiv("explorer");
    setHinweis({ text: "Zurückgesetzt — der Stick ist wieder leer.", gut: false });
  }

  // ── Taskleiste & Start ──────────────────────────────────────────────
  function taskleisteKlick(id: AppId) {
    if (demo.aktiv) return;
    if (id === "explorer") explorerOeffnen();
    else if (id === "editor") {
      if (editor.offen) setAktiv("editor");
      else editorOeffnen(editor.datei);
    }
  }

  function einAus(wahl: EinAus) {
    setStartOffen(false);
    setSysMenue(false);
    if (wahl === "energiesparen") { fehlversuch(system === "ubuntu" ? "»Bildschirm sperren« schaltet nicht aus." : `»${system === "macos" ? "Ruhezustand" : "Energie sparen"}« lässt den Computer nur schlafen — er ist nicht aus.`); return; }
    if (wahl === "neustart") { fehlversuch(`»Neu starten« fährt ihn gleich wieder hoch. Gesucht ist »${system === "windows" ? "Herunterfahren" : "Ausschalten"}«.`); return; }
    if (aufgabe.id !== "herunterfahren") { setHinweis({ text: "Noch nicht ausschalten — erst die anderen Aufgaben.", gut: false }); return; }
    if (editor.offen && geaendert) {
      setHinweis({ text: "Im Editor ist noch etwas nicht gespeichert — speichere es zuerst, sonst wäre es beim Ausschalten weg.", gut: false });
      return;
    }
    setAus("faehrt");
    setTimeout(() => { setAus("aus"); geschafft("herunterfahren", "Der Computer ist aus. Gut gemacht!"); }, 2200);
  }

  // ── Vorführung ──────────────────────────────────────────────────────
  function vorfuehren() {
    vorDemo.current = { fs, inhalte, editor, dialog, explorer, aktiv, startOffen };
    setSysMenue(false);
    demoLaeuft.current = true;
    const ort = (sel: string) => () => mitte(document.querySelector(sel));
    const zeigeExplorer = (ordner: string) => { setExplorer({ offen: true, ordner, markiert: null }); setAktiv("explorer"); };
    const eigene = meineDatei.current;
    let schritte: DemoSchritt[] = [];
    if (aufgabe.id === "schreiben") {
      schritte = [
        { text: "In das weiße Feld des Editors klicken.", zu: () => mitte(textRef.current), taste: "links", aktion: () => editorOeffnen(editor.datei) },
        { text: "Lostippen: »Mein Hund heißt Bello.«", aktion: () => setEditor(e => ({ ...e, offen: true, text: "Mein Hund heißt Bello." })) },
      ];
    } else if (aufgabe.id === "speichernUnter") {
      schritte = [
        { text: "Oben im Editor auf »Datei« klicken.", zu: () => mitte(dateiKnopf.current), taste: "links", aktion: () => setDateiMenue(true) },
        { text: "»Speichern unter …« wählen.", zu: ort('[data-datei-menue="speichernUnter"]'), taste: "links", aktion: () => { setDateiMenue(false); setDialog("speichernUnter"); } },
        { text: "Links »Dokumente« wählen.", zu: ort('[data-testid="speichern-unter"] [data-nav="dokumente"]'), taste: "links" },
        { text: "Einen eigenen Namen eintippen, z. B. »Mein Tier«.", zu: ort('[data-testid="dateiname"]'), taste: "links" },
        { text: "Auf »Speichern« klicken.", zu: ort('[data-testid="speichern-knopf"]'), taste: "links" },
      ];
    } else if (aufgabe.id === "schliessen") {
      schritte = [
        { text: "Noch einen Satz anhängen — oben erscheint ein Sternchen *.", zu: () => mitte(textRef.current), aktion: () => setEditor(e => ({ ...e, offen: true, text: `${e.text}\nEr spielt gern im Garten.` })) },
        { text: "Oben rechts auf ✕ klicken.", zu: () => mitte(schliessenKnopf.current), taste: "links", aktion: () => setDialog("frage") },
        { text: "Der Editor fragt — »Speichern« wählen.", zu: ort('[data-frage="speichern"]'), taste: "links" },
      ];
    } else if (aufgabe.id === "wiederfinden") {
      schritte = [
        { text: "Doppelklick auf »Dieser PC«.", zu: ort('[data-desktop-symbol="dieserpc"]'), taste: "doppel", aktion: () => zeigeExplorer("pc") },
        { text: "Links in der Seitenleiste auf »Dokumente« klicken.", zu: ort('[data-explorer] [data-nav="dokumente"]'), taste: "links", aktion: () => zeigeExplorer("dokumente") },
        { text: "Deine Datei doppelklicken.", zu: ort(eigene ? `[data-explorer] [data-knoten="${eigene}"]` : '[data-explorer] [data-testid="explorer-liste"]'), taste: "doppel" },
      ];
    } else if (aufgabe.id === "usbFinden") {
      schritte = [
        { text: "Explorer öffnen: Klick auf das Ordner-Symbol in der Taskleiste.", zu: ort('[data-taskleiste="explorer"]'), taste: "links", aktion: () => zeigeExplorer("pc") },
        { text: "Links in der Seitenleiste: »USB-Stick (D:)«.", zu: ort('[data-explorer] [data-nav="usb"]'), taste: "links", aktion: () => zeigeExplorer("usb") },
      ];
    } else if (aufgabe.id === "aufStick") {
      schritte = [
        { text: "Im Explorer »Dokumente« öffnen.", zu: ort('[data-explorer] [data-nav="dokumente"]'), taste: "links", aktion: () => zeigeExplorer("dokumente") },
        { text: "Deine Datei greifen: Taste festhalten …", zu: ort(eigene ? `[data-explorer] [data-knoten="${eigene}"]` : '[data-explorer] [data-testid="explorer-liste"]'), taste: "halten" },
        { text: "… links auf »USB-Stick (D:)« ziehen …", zu: ort('[data-explorer] [data-nav="usb"]'), taste: "halten", ms: 2000 },
        { text: "… und loslassen. Die Datei wird kopiert.", taste: null },
      ];
    } else if (aufgabe.id === "herunterfahren" && system !== "windows") {
      schritte = [
        { text: system === "macos" ? "Oben links auf ● klicken." : "Oben rechts auf ⏻ klicken.", zu: ort("[data-system-menue]"), taste: "links", aktion: () => setSysMenue(true) },
        { text: "»Ausschalten …« wählen.", zu: ort('[data-einaus-wahl="herunterfahren"]'), taste: "links" },
      ];
    } else if (aufgabe.id === "herunterfahren") {
      schritte = [
        { text: "Unten auf »Start« klicken.", zu: ort("[data-start]"), taste: "links", aktion: () => setStartOffen(true) },
        { text: "Unten rechts im Startmenü: der Ein/Aus-Knopf.", zu: ort("[data-einaus]"), taste: "links", aktion: () => setEinAusDemo(true) },
        { text: "»Herunterfahren« wählen.", zu: ort('[data-einaus-wahl="herunterfahren"]'), taste: "links" },
      ];
    }
    demo.abspielen(schritte.map(x => ({ ...x, text: t(x.text) })));
  }

  // ── Anzeige ─────────────────────────────────────────────────────────
  const hilfeGroesse = hilfe ? HILFE_GROESSE : 1;
  const knopf = 22 * hilfeGroesse;
  const symbol = Math.round(11 * hilfeGroesse);
  const dunkel = aussehen.dunkel;
  const fenster = dunkel
    ? { grund: "#202020", leiste: "#2b2b2b", text: "#ffffff", linie: "#ffffff1f", leise: "#a3a3a3" }
    : { grund: "#ffffff", leiste: "#f3f3f3", text: "#1a1a1a", linie: "#0000001a", leise: "#616161" };

  const offen: AppId[] = [
    ...(editor.offen ? (["editor"] as AppId[]) : []),
    ...(explorer.offen ? (["explorer"] as AppId[]) : []),
  ];

  const punkte = wertung({
    stufe: "datei", geloest: Math.min(nr, AUFGABEN.length), anzahl: AUFGABEN.length,
    dauerMs: Math.round(performance.now() - start.current), fehler: fehler.current,
  }).punkte;

  function titelleiste(titel: ReactNode, onZu: () => void, zuRef?: React.Ref<HTMLButtonElement>) {
    const knoepfe = <FensterKnoepfe onSchliessen={onZu} schliessenRef={zuRef} groesse={knopf} symbol={symbol} />;
    return (
      <div className="flex items-center gap-2 px-2 shrink-0" style={{ height: 32 * hilfeGroesse, background: fenster.leiste, borderBottom: `1px solid ${fenster.linie}` }}>
        {links && knoepfe}
        {titel}
        {!links && knoepfe}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Stufenkopf
        titel="💾 Teil 2 · Speichern & USB-Stick"
        auftrag={fertig ? <>Geschrieben, gespeichert, wiedergefunden, auf den Stick gebracht und ausgeschaltet — alles geschafft!</> : (
          <>
            {aufgabe.titel}
            <ol className="list-decimal list-inside text-sm font-normal mt-1.5 flex flex-col gap-0.5">
              {aufgabe.schritte.map((s, i) => <li key={i}>{typeof s === "string" ? mitTasten(s) : s}</li>)}
            </ol>
            {(aufgabe.id === "speichernUnter" || aufgabe.id === "schliessen") && (
              <div data-zusatz className="text-sm text-muted mt-1.5">
                💡 {mitTasten(system === "macos"
                  ? "Schneller: [[⌘]] + [[S]] sichert, [[⌘]] + [[⇧]] + [[S]] ist »Speichern unter«."
                  : "Schneller: [[Strg]] + [[S]] speichert, [[Strg]] + [[Umschalt]] + [[S]] ist »Speichern unter«.")}
              </div>
            )}
          </>
        )}
        punkte={punkte}
        onDemo={fertig ? undefined : vorfuehren}
        onWeiter={onWeiter}
        hervor={fertig}
      >
        <AvatarDisplay avatarId={avatar} size="md" />
      </Stufenkopf>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <WindowsDesktop
          aussehen={aussehen}
          symbole={["dieserpc"]}
          taskleiste={["explorer", "editor"]}
          offen={offen}
          aktiv={aktiv}
          onSymbol={id => { if (id === "dieserpc") explorerOeffnen(); }}
          onTaskleiste={taskleisteKlick}
          onStart={() => { if (!demo.aktiv) setStartOffen(o => !o); }}
          onSystemMenue={() => { if (!demo.aktiv) setSysMenue(m => !m); }}
          startOffen={startOffen}
          overlay={<>
            {sysMenue && system !== "windows" && (
              <div
                role="menu"
                data-system-menue-liste
                className={"pointer-events-auto absolute rounded-xl py-1 shadow-2xl border flex flex-col min-w-[12em] text-sm "
                  + (system === "ubuntu" ? "right-[1%] bg-[#303030] text-white border-[#ffffff1f]" : "left-[1%] bg-[#ecececf2] text-[#111] border-[#0000001a]")}
                style={{ top: "6.5%" }}
              >
                {(system === "ubuntu"
                  ? [["energiesparen", "🔒 Bildschirm sperren"], ["neustart", "↻ Neu starten …"], ["herunterfahren", "⏻ Ausschalten …"]]
                  : [["energiesparen", "Ruhezustand"], ["neustart", "Neustart …"], ["herunterfahren", "Ausschalten …"]]
                ).map(([id, text]) => (
                  <button key={id} type="button" role="menuitem" data-einaus-wahl={id} onClick={() => einAus(id as EinAus)}
                    className={"px-3 py-1.5 text-left " + (system === "ubuntu" ? "hover:bg-[#ffffff1a]" : "hover:bg-[#0a60ff] hover:text-white")}>
                    {text}
                  </button>
                ))}
              </div>
            )}
            {startOffen && (
              <Startmenue
                suchText=""
                onSuchText={() => {}}
                angeheftet={aussehen.taskleiste}
                onApp={id => { setStartOffen(false); if (id === "explorer") explorerOeffnen(); else if (id === "editor") taskleisteKlick("editor"); }}
                onTreffer={() => setStartOffen(false)}
                benutzer={benutzer}
                profilTier={aussehen.profilTier}
                dunkel={dunkel}
                akzent={akzentFarbe(aussehen.akzent)}
                hilfe={hilfe}
                onSchliessen={() => setStartOffen(false)}
                onEinAus={einAus}
                einAusOffen={einAusDemo}
              />
            )}

            {usbMeldung && (
              <div className="pointer-events-auto absolute right-[2%] bottom-[13%] flex items-center gap-3 rounded-lg shadow-2xl border px-3 py-2 text-sm"
                style={{ background: fenster.leiste, color: fenster.text, borderColor: fenster.linie}}
                role="status">
                <OrdnerSymbol knoten={usb} groesse={32} />
                <div>
                  <div className="font-bold">{usb.name}</div>
                  <div style={{ color: fenster.leise }}>Ein Wechseldatenträger wurde angeschlossen.</div>
                </div>
              </div>
            )}

            {dialog === "frage" && (
              <div className="absolute inset-0 bg-[#0000004d] flex items-center justify-center pointer-events-auto">
                <div className="rounded-lg shadow-2xl border p-4 flex flex-col gap-3 max-w-[22em]" style={{ background: fenster.grund, color: fenster.text, borderColor: fenster.linie }} role="dialog" aria-label="Editor">
                  <p className="text-sm font-bold">Möchtest du die Änderungen an »{dateiName}« speichern?</p>
                  <div className="flex flex-wrap gap-2 text-sm justify-end">
                    <button type="button" data-frage="speichern" onClick={() => frageAntwort("speichern")} className="rounded-sm px-3 py-1.5 bg-[#0078d7] text-white font-semibold">Speichern</button>
                    <button type="button" onClick={() => frageAntwort("nicht")} className="rounded-sm px-3 py-1.5 border" style={{ borderColor: fenster.linie }}>Nicht speichern</button>
                    <button type="button" onClick={() => frageAntwort("abbrechen")} className="rounded-sm px-3 py-1.5 border" style={{ borderColor: fenster.linie }}>Abbrechen</button>
                  </div>
                </div>
              </div>
            )}

            {dialog === "speichernUnter" && (
              <div className="absolute inset-0 bg-[#0000004d] flex items-center justify-center pointer-events-auto">
                <div style={{ width: "min(92%, 32em)" }}>
                  <SpeichernUnter
                    fs={fs}
                    startOrdner="dokumente"
                    vorschlag="Unbenannt"
                    endung=".txt"
                    dunkel={dunkel}
                    hilfe={hilfe}
                    onSpeichern={speichernUnterFertig}
                    onAbbrechen={() => { nachSpeichernSchliessen.current = false; setDialog(null); }}
                    onFehler={() => { fehler.current += 1; }}
                  />
                </div>
              </div>
            )}

            {aus && (
              <div className="absolute inset-0 bg-black text-white flex flex-col items-center justify-center gap-3 pointer-events-auto" data-testid="ausgeschaltet">
                {aus === "faehrt" ? (
                  <>
                    <span className="w-8 h-8 rounded-full border-4 border-white/30 border-t-white animate-spin" />
                    <span className="text-sm">Wird heruntergefahren …</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl" aria-hidden>💤</span>
                    <span className="text-sm text-white/70">Der Computer ist aus.</span>
                    <button type="button" onClick={() => setAus(null)} className="mt-2 rounded-full border border-white/40 px-4 py-1.5 text-sm hover:bg-white/10">
                      ⏻ Wieder einschalten
                    </button>
                  </>
                )}
              </div>
            )}
          </>}
        >
          {editor.offen && (
            <div
              data-editor
              className="pointer-events-auto absolute rounded-lg shadow-xl border flex flex-col overflow-hidden"
              style={{ left: "4%", top: "5%", width: "58%", height: "74%", zIndex: aktiv === "editor" ? 2 : 1, background: fenster.grund, color: fenster.text, borderColor: fenster.linie }}
              onPointerDown={() => setAktiv("editor")}
            >
              {titelleiste(
                <>
                  <AppSymbol id="editor" groesse={16} titel={false} />
                  <span className="text-sm flex-1 truncate" data-testid="editor-titel">{geaendert ? "*" : ""}{dateiName} – {appName("editor", system)}</span>
                </>,
                schliessenKlick,
                schliessenKnopf,
              )}
              <div className="relative flex items-center gap-1 px-1 text-sm shrink-0" style={{ borderBottom: `1px solid ${fenster.linie}` }}>
                <button ref={dateiKnopf} type="button" onClick={() => setDateiMenue(m => !m)}
                  className={"rounded-sm px-2 py-0.5 " + (dateiMenue ? "bg-[#0078d738]" : "hover:bg-[#0078d71a]")} aria-expanded={dateiMenue}>
                  {system === "macos" ? "Ablage" : "Datei"}
                </button>
                <span className="px-2 py-0.5" style={{ color: fenster.leise }}>Bearbeiten</span>
                <span className="px-2 py-0.5" style={{ color: fenster.leise }}>Ansicht</span>
                {dateiMenue && (
                  <div role="menu" className="absolute left-1 top-full z-10 rounded-lg shadow-xl border py-1 min-w-[16em] text-sm" style={{ background: fenster.grund, borderColor: fenster.linie }}>
                    {([
                      ["neu", "Neu", "Strg+N", null],
                      ["oeffnen", "Öffnen …", "Strg+O", null],
                      ["speichern", "Speichern", "Strg+S", speichern],
                      ["speichernUnter", "Speichern unter …", "Strg+Umschalt+S", speichernUnterOeffnen],
                      ["beenden", "Beenden", "", schliessenKlick],
                    ] as const).map(([id, text, kuerzel, tun]) => (
                      <button key={id} type="button" role="menuitem" data-datei-menue={id} disabled={!tun}
                        onClick={() => tun?.()}
                        className="w-full flex items-center gap-6 px-3 py-1.5 text-left hover:bg-[#0078d71a] disabled:opacity-40 disabled:hover:bg-transparent">
                        <span className="flex-1">{text}</span>
                        <span className="text-xs" style={{ color: fenster.leise }}>{kuerzel}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <textarea
                ref={textRef}
                value={editor.text}
                onChange={e => tippen(e.target.value)}
                onKeyDown={tasteImEditor}
                onFocus={() => setDateiMenue(false)}
                spellCheck={false}
                aria-label="Text im Editor"
                className="flex-1 resize-none p-2 outline-hidden"
                style={{ background: fenster.grund, color: fenster.text, fontFamily: "Consolas, 'Cascadia Mono', monospace", fontSize: hilfe ? 17 : 14 }}
              />
              <div className="flex gap-4 px-2 py-0.5 text-xs shrink-0" style={{ color: fenster.leise, borderTop: `1px solid ${fenster.linie}` }}>
                <span>{woerter(editor.text)} Wörter</span>
                <span className="flex-1" />
                <span>UTF-8</span>
              </div>
            </div>
          )}

          {explorer.offen && (
            <div
              data-explorer
              className="pointer-events-auto absolute rounded-lg shadow-xl border flex flex-col overflow-hidden"
              style={{ left: "26%", top: "9%", width: "70%", height: "72%", zIndex: aktiv === "explorer" ? 2 : 1, borderColor: fenster.linie }}
              onPointerDown={() => setAktiv("explorer")}
            >
              {titelleiste(
                <>
                  <AppSymbol id="explorer" groesse={16} titel={false} />
                  <span className="text-sm flex-1 truncate" style={{ color: fenster.text }}>{fs[explorer.ordner]?.name ?? sys.dateimanager}</span>
                </>,
                () => { setExplorer(x => ({ ...x, offen: false })); setAktiv(editor.offen ? "editor" : null); },
              )}
              <div className="flex-1 min-h-0">
                <ExplorerInhalt
                  fs={fs}
                  ordner={explorer.ordner}
                  onOrdner={ordnerWechsel}
                  onOeffnen={dateiOeffnen}
                  markiert={explorer.markiert}
                  onMarkieren={k => setExplorer(x => ({ ...x, markiert: k?.id ?? null }))}
                  onAblegen={abgelegt}
                  onLoeschen={loeschen}
                  dunkel={dunkel}
                  hilfe={hilfe}
                />
              </div>
            </div>
          )}
        </WindowsDesktop>

        <aside className="rounded-2xl border border-line bg-surface p-4 flex flex-col gap-3 h-fit">
          <h3 className="font-black">Aufgaben</h3>
          <ul className="flex flex-col gap-1.5">
            {AUFGABEN.map((a, i) => (
              <li key={a.id} className={"text-sm flex gap-2 " + (i === nr ? "font-bold" : i < nr ? "text-muted" : "")}>
                <span>{i < nr ? "✅" : i === nr ? "👉" : "⬜"}</span>
                <span>{a.kurz}</span>
              </li>
            ))}
          </ul>
          {(aufgabe.id === "usbFinden" || aufgabe.id === "aufStick") && !fertig && (
            <div className="flex flex-col gap-1.5 text-sm text-muted">
              <span>{mitTasten(t(`Falsche Datei auf dem Stick? Markieren und ${sys.kuerzel.loeschen} drücken oder oben im Explorer auf 🗑.`))}</span>
              <button type="button" onClick={stickZuruecksetzen} disabled={demo.aktiv} data-testid="stick-zuruecksetzen" className="btn-secondary self-start">
                ↺ Aufgabe zurücksetzen
              </button>
            </div>
          )}
          <div className="min-h-12 text-sm font-bold" aria-live="polite"
            style={{ color: hinweis?.gut ? "var(--green, #16a34a)" : "var(--text-muted)" }}>
            {hinweis?.text}
          </div>
        </aside>
      </div>

      <DemoBuehne demo={demo} />
    </div>
  );
}
