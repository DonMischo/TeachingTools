"use client";
/**
 * Videotext: Seite 100. Alle Seiten kreisen im Fernsehsignal im Karussell; wer eine
 * Seite will, muss warten, bis sie wieder vorbeikommt.
 */
import { useEffect, useRef, useState } from "react";
import { ton } from "./ton";
import { useErprobt } from "@/lib/medien/erprobt";

type Farbe = "w" | "y" | "c" | "g" | "r" | "m" | "b" | "k";
const FARBE: Record<Farbe, string> = { w: "#ffffff", y: "#ffff00", c: "#00ffff", g: "#00ff00", r: "#ff0000", m: "#ff00ff", b: "#0000ff", k: "#000000" };
type Seg = { t: string; f?: Farbe; bg?: Farbe };
type Mos = { mos: string[] };
type Zeile = Seg[] | Mos;
export type Seite = { nr: number; unter: Zeile[][]; auto?: boolean; bg?: string };

const z = (t: string, f: Farbe = "w"): Zeile => [{ t, f }];
const kopf = (t: string): Zeile => [{ t: (" " + t).padEnd(40), f: "w", bg: "b" }];
const leer: Zeile = [];
const nr2 = (nr: string, t: string): Zeile => [{ t: nr, f: "y" }, { t: " " + t, f: "w" }];
const mosaik = (kunst: string[]): Zeile[] => {
  const out: Zeile[] = [];
  for (let i = 0; i < kunst.length; i += 3) out.push({ mos: [kunst[i] ?? "", kunst[i + 1] ?? "", kunst[i + 2] ?? ""] });
  return out;
};

const T = ["cccccccc", "...cc...", "...cc...", "...cc...", "...cc...", "...cc..."];
const TV = ["yyyyyyyyyyyyyy", "y............y", "y.gggggggggg.y", "y.gggggggggg.y", "y............y", "yyyyyyyyyyyyyy"];
const LOGO = T.map((r, i) => "..." + r + ".." + r.replace(/c/g, "m") + "........" + TV[i]);

function karte(): string[] {
  const rows: string[] = [];
  for (let y = 0; y < 30; y++) {
    let s = "";
    for (let x = 0; x < 80; x++) {
      const dx = (x - 40) / 20, dy = (y - 15) / 12;
      const innen = dx * dx + dy * dy < 1 + 0.15 * Math.sin(x / 3 + y / 2);
      let c = "b";
      if (innen) {
        c = "g";
        if ((x - 32) ** 2 + (y - 10) ** 2 < 16) c = "y";
        else if (x >= 48 && x <= 60 && y >= 10 && y <= 14) c = "w";
        else if (x >= 34 && x <= 46 && y >= 20 && y <= 24) c = (x + y) % 2 ? "c" : "g";
      }
      s += c;
    }
    rows.push(s);
  }
  return rows;
}

const SEITEN: Seite[] = [
  {
    nr: 100,
    unter: [[
      ...mosaik(LOGO), leer,
      nr2("101", "Nachrichten (3 Seiten)"), nr2("150", "Wetter     170 Wetterkarte"), nr2("200", "Sport"),
      nr2("333", "Witz der Seite"), nr2("400", "Fernsehprogramm"), nr2("777", "Rätsel"), nr2("888", "Untertitel"),
      leer, z("Tippe drei Ziffern, z. B. 333.", "c"), z("Oder nimm die bunten Tasten.", "c"),
    ]],
  },
  {
    nr: 101, auto: true,
    unter: [
      [kopf("NACHRICHTEN 1/3"), leer, z("Rohrpost in Berlin eingestellt", "y"), leer, z("Nach 100 Jahren rauscht die letzte"), z("Büchse durch die Röhre. Die Post"), z("sagt: Keine Panik, es gibt ja jetzt"), z("E-Mail.")],
      [kopf("NACHRICHTEN 2/3"), leer, z("Erstes Fax aus dem Klassenzimmer", "y"), leer, z("Klasse 8b schickte ein Fax an die"), z("Parallelklasse. Es kam an - nur"), z("leider 40 Minuten zu spät.")],
      [kopf("NACHRICHTEN 3/3"), leer, z("Pinguin lernt SMS", "y"), leer, z("Ein Pinguin im Zoo tippte mit T9"), z("das Wort »FISCH«. Dauer: 3 Stunden."), z("Er findet Touchscreens besser.")],
    ],
  },
  {
    nr: 150,
    unter: [[
      kopf("WETTER HEUTE"), leer, nr2("Berlin  ", "sonnig        14°"), nr2("Erfurt  ", "Wolken        11°"),
      nr2("Hamburg ", "Regen          9°"), nr2("München ", "Föhn          16°"), nr2("Brocken ", "Nebel, wie immer 2°"),
      leer, z("Karte: Seite 170", "c"),
    ]],
  },
  {
    nr: 170,
    unter: [[
      kopf("WETTERKARTE"), ...mosaik(karte()),
      [{ t: "■ Sonne  ", f: "y" }, { t: "■ Wolken  ", f: "w" }, { t: "■ Regen", f: "c" }],
    ]],
  },
  {
    nr: 200,
    unter: [[
      kopf("SPORT"), leer, z("Rohrpost-Cup", "y"), z("Berlin - Hamburg 3:2"), leer, z("Büchsenweitwurf", "y"), z("Neuer Schulrekord: 4,2 Meter"), leer,
      z("Tischtennis", "y"), z("Schüler schlagen Lehrer 11:9"), z("(Der Lehrer will ein Rückspiel.)"),
    ]],
  },
  {
    nr: 333,
    unter: [[
      kopf("WITZ DER SEITE"), leer, leer, z("Warum ist die Kassette nie pünktlich?", "y"), leer, z("Sie muss erst zurückspulen."), leer, z("Ba-dum-tss!", "m"),
    ]],
  },
  {
    nr: 400,
    unter: [[
      kopf("TT1 FERNSEHEN - HEUTE"), leer, nr2("16:00", "Das Testbild lächelt"), nr2("16:05", "Kater Kalle erklärt die Welt"),
      nr2("17:00", "Nachrichten in 100 Sekunden"), nr2("17:30", "Wie funktioniert Rohrpost?"), nr2("18:00", "Der Laser und die Rille"),
      nr2("18:45", "Wetter und Videotext-Quiz"), nr2("19:00", "Schlafenszeit für das Testbild"),
    ]],
  },
  {
    nr: 777,
    unter: [
      [kopf("RÄTSEL 1/2"), leer, z("Ich bestehe aus 625 Zeilen,"), z("aber ich bin kein Heft."), z("Ich leuchte, aber ich bin keine Lampe."), z("Ich zeige Bilder, aber ich bin kein"), z("Fotoalbum. Was bin ich?"), leer, z("Lösung: Taste ▶ drücken", "c")],
      [kopf("RÄTSEL 2/2"), leer, z("Lösung:", "y"), leer, z("DAS FERNSEHBILD!", "g"), leer, z("Ein Strahl malt Zeile für Zeile.")],
    ],
  },
  {
    nr: 888, bg: "#0b1a33",
    unter: [[
      ...mosaik(["...................yyy", "..................yyyyy", "...................yyy"].map(r => ".".repeat(50) + r)),
      leer, leer, leer, leer, leer, leer, leer, leer, leer, leer, leer, leer, leer,
      [{ t: " Und dann kam die Rohrpost zurück! ", f: "y", bg: "k" }],
    ]],
  },
];

export const seite = (nr: number): Seite | undefined => SEITEN.find(s => s.nr === nr);

const WT = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const p2 = (x: number) => String(x).padStart(2, "0");
const RH = 15;
const wrap = (x: number) => 100 + ((((x - 100) % 800) + 800) % 800);
const STANDARD: [number, string, Farbe][] = [[100, "Index", "r"], [101, "Nachr.", "g"], [400, "TV", "y"], [777, "Rätsel", "c"]];

type Suche = { ziel: number; cur: number; rest: number; bekannt: boolean };

export function VideotextDemo() {
  const erprobt = useErprobt();
  const [anz, setAnz] = useState({ nr: 100, sub: 0 });
  const [eingabe, setEingabe] = useState("");
  const [suche, setSuche] = useState<Suche | null>(null);
  const [nichtda, setNichtda] = useState<number | null>(null);
  const [jetzt, setJetzt] = useState<Date | null>(null);
  const besucht = useRef(new Set<number>());
  const gemeldet = useRef(false);

  useEffect(() => {
    setJetzt(new Date());
    const id = setInterval(() => setJetzt(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const aktiv = suche !== null && suche.rest > 0;
  useEffect(() => {
    if (!aktiv) return;
    const id = setInterval(() => {
      setSuche(s => {
        if (!s || s.rest <= 0) return s;
        const step = Math.min(10, s.rest);
        return { ...s, cur: wrap(s.cur + step), rest: s.rest - step };
      });
    }, 50);
    return () => clearInterval(id);
  }, [aktiv]);

  useEffect(() => {
    if (!suche || suche.rest > 0) return;
    if (suche.bekannt) {
      setAnz({ nr: suche.ziel, sub: 0 });
      besucht.current.add(suche.ziel);
      ton(880, 0.06, 0, "square", 0.05);
      if (besucht.current.size >= 3 && !gemeldet.current) { gemeldet.current = true; erprobt("videotext"); }
    } else setNichtda(suche.ziel);
    setSuche(null);
    setEingabe("");
  }, [suche, erprobt]);

  const aktSeite = seite(anz.nr)!;
  const anzahl = aktSeite.unter.length;
  useEffect(() => {
    if (!aktSeite.auto || anzahl < 2) return;
    const id = setTimeout(() => setAnz(a => ({ ...a, sub: (a.sub + 1) % anzahl })), 8000);
    return () => clearTimeout(id);
  }, [anz.nr, anz.sub, aktSeite.auto, anzahl]);

  const gehe = (ziel: number) => {
    setNichtda(null);
    const bekannt = !!seite(ziel);
    const dist = (ziel - anz.nr + 800) % 800;
    setEingabe(String(ziel));
    setSuche({ ziel, cur: anz.nr, rest: bekannt ? dist : 800, bekannt });
  };
  const ziffer = (d: string) => {
    setSuche(null); setNichtda(null);
    ton(500 + Number(d) * 40, 0.04, 0, "square", 0.04);
    const neu = eingabe.length >= 3 || eingabe.length === 0 ? d : eingabe + d;
    if (neu.length === 3) gehe(Number(neu)); else setEingabe(neu);
  };
  const blaettern = (r: number) => {
    if (anzahl > 1) setAnz(a => ({ ...a, sub: (a.sub + r + anzahl) % anzahl }));
  };

  let kopfSegs: Seg[];
  if (suche) kopfSegs = [{ t: String(suche.cur), f: "w" }, { t: " TT-Text   Suche ", f: "w" }, { t: String(suche.ziel), f: "y" }, { t: " …", f: "y" }];
  else if (eingabe.length > 0 && eingabe.length < 3) kopfSegs = [{ t: eingabe.padEnd(3, "_") + " TT-Text", f: "w" }];
  else {
    const d = jetzt;
    const uhr = d ? `${WT[d.getDay()]} ${p2(d.getDate())}.${p2(d.getMonth() + 1)}.  ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}` : "";
    kopfSegs = [{ t: `${nichtda ?? anz.nr} TT-Text   `, f: "w" }, { t: uhr, f: "y" }];
  }
  const zeilen: Zeile[] = [kopfSegs, ...aktSeite.unter[anz.sub]];
  while (zeilen.length < 22) zeilen.push(leer);
  if (nichtda !== null) zeilen[11] = [{ t: " Seite nicht vorhanden ", f: "w", bg: "r" }];
  zeilen[22] = anzahl > 1 ? [{ t: `Unterseite ${anz.sub + 1}/${anzahl}`, f: "c" }] : leer;
  zeilen[23] = STANDARD.map(([, name, f]) => ({ t: name.padEnd(10), f: "k" as Farbe, bg: f }));

  const rendereZeile = (zl: Zeile, r: number) => {
    const y = r * RH;
    if (!Array.isArray(zl)) {
      return zl.mos.map((s, p) => {
        const runs: React.ReactElement[] = [];
        for (let i = 0; i < s.length; ) {
          let j = i;
          while (j < s.length && s[j] === s[i]) j++;
          const f = FARBE[s[i] as Farbe];
          if (f && s[i] !== ".") runs.push(<rect key={i} x={i * 5} y={y + p * 5} width={(j - i) * 5} height={5} fill={f} />);
          i = j;
        }
        return <g key={p}>{runs}</g>;
      });
    }
    let col = 0;
    return zl.map((sg, k) => {
      const t = sg.t.slice(0, Math.max(0, 40 - col));
      const x = col * 10;
      col += t.length;
      return (
        <g key={k}>
          {sg.bg && <rect x={x} y={y} width={t.length * 10} height={RH} fill={FARBE[sg.bg]} />}
          <text x={x} y={y + RH - 3.5} fontSize="13" fontWeight="bold" fontFamily="ui-monospace, Menlo, Consolas, monospace"
            fill={FARBE[sg.f ?? "w"]} textLength={t.length * 10} lengthAdjust="spacingAndGlyphs" style={{ whiteSpace: "pre" }}>{t}</text>
        </g>
      );
    });
  };

  const tasten = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="card space-y-3 p-3">
      <div className="mx-auto w-full max-w-md rounded-[28px] border border-line bg-surface-hover p-3">
        <svg viewBox={`0 0 400 ${24 * RH}`} className="block w-full rounded-[18px]" style={{ background: aktSeite.bg ?? "#000" }}
          role="img" aria-label={`Videotext-Seite ${anz.nr}`}>
          {zeilen.map((zl, r) => <g key={r}>{rendereZeile(zl, r)}</g>)}
        </svg>
      </div>

      <div className="mx-auto w-full max-w-xs space-y-2 rounded-2xl border border-line p-3">
        <div className="grid grid-cols-3 gap-2">
          {tasten.map(d => <button key={d} type="button" className="btn-secondary font-mono" onClick={() => ziffer(d)}>{d}</button>)}
          <button type="button" className="btn-secondary" onClick={() => blaettern(-1)} aria-label="Unterseite zurück">◀</button>
          <button type="button" className="btn-secondary font-mono" onClick={() => ziffer("0")}>0</button>
          <button type="button" className="btn-secondary" onClick={() => blaettern(1)} aria-label="Unterseite vor">▶</button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {([["rot", "#dc2626", 100], ["grün", "#16a34a", 101], ["gelb", "#eab308", 400], ["blau", "#2563eb", 777]] as const).map(([name, bg, nr]) => (
            <button key={name} type="button" className="rounded-lg px-1 py-2 text-xs font-bold" style={{ background: bg, color: name === "gelb" ? "#000" : "#fff" }}
              onClick={() => gehe(nr)}>{name}</button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">
        Alle Seiten kreisen ständig im Fernsehsignal, eine nach der anderen. Dein Fernseher wartet, bis die gewünschte Seite
        vorbeikommt – darum dauert 101 nach 100 nur einen Wimpernschlag, 777 aber eine kleine Ewigkeit. Probier es aus!
      </p>
    </div>
  );
}
