"use client";
/** Gelände aus Rauschen: Oktave für Oktave aufbauen, Domain Warping, Insel, Meeresspiegel. */
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GELAENDE_STANDARD, gelaende, hoehenFarbe, oktave, type Form, type GelaendeOptionen } from "@/lib/spielalgo/rauschen";
import { Buehne, Frage, Notiz, Rahmen, Regler, Steuerung, auswahl, useAblauf } from "./gemeinsam";
import { Hinweis, Vertiefung, Wahl } from "./Vertiefung";
import { CODE_GELAENDE } from "./code";

type Ansicht = "karte" | "grau";

function male(ctx: CanvasRenderingContext2D, z: Float32Array, n: number, ansicht: Ansicht, meer: number) {
  const bild = ctx.createImageData(n, n);
  for (let i = 0; i < z.length; i++) {
    const [r, g, b] = ansicht === "karte" ? hoehenFarbe(z[i], meer) : [z[i] * 255, z[i] * 255, z[i] * 255];
    bild.data[4 * i] = r; bild.data[4 * i + 1] = g; bild.data[4 * i + 2] = b; bild.data[4 * i + 3] = 255;
  }
  ctx.putImageData(bild, 0, 0);
}

export default function Gelaende() {
  const [seed, setSeed] = useState(1);
  const [massstab, setMassstab] = useState(GELAENDE_STANDARD.massstab);
  const [oktaven, setOktaven] = useState(GELAENDE_STANDARD.oktaven);
  const [persistenz, setPersistenz] = useState(GELAENDE_STANDARD.persistenz);
  const [lakunaritaet, setLakunaritaet] = useState(GELAENDE_STANDARD.lakunaritaet);
  const [warp, setWarp] = useState(0);
  const [insel, setInsel] = useState(true);
  const [meer, setMeer] = useState(0.42);
  const [ansicht, setAnsicht] = useState<Ansicht>("karte");
  const [basis, setBasis] = useState<"gradient" | "wert">("gradient");
  const [form, setForm] = useState<Form>("glatt");
  const [inselForm, setInselForm] = useState<"kreis" | "quadrat">("kreis");
  const gezeigt = useRef(1);

  // Abspielen = Oktaven nacheinander dazulegen
  const ablauf = useAblauf(() => (function* () {
    for (let k = 1; k <= oktaven; k++) {
      gezeigt.current = k;
      yield k === 1 ? "Oktave 1: große, weiche Hügel – die Grundform." : `Oktave ${k} dazu: ${lakunaritaet.toString().replace(".", ",")}-mal so fein, ${Math.round(persistenz ** (k - 1) * 100)} % so stark.`;
    }
    return warp > 0 ? "Fertig – mit Domain Warping: Die Koordinaten selbst wurden verbogen." : "Fertig.";
  })(), [seed, massstab, oktaven, persistenz, lakunaritaet, warp, basis, form], 0.05);

  const o: GelaendeOptionen = { seed, groesse: 256, massstab, oktaven: Math.min(gezeigt.current, oktaven), persistenz, lakunaritaet, warp, insel, basis, form, inselForm };
  const z = useMemo(() => gelaende(o), [seed, massstab, o.oktaven, persistenz, lakunaritaet, warp, insel, basis, form, inselForm]); // eslint-disable-line react-hooks/exhaustive-deps
  const schichten = useMemo(
    () => Array.from({ length: oktaven }, (_, k) => oktave({ ...o, groesse: 64 }, k)),
    [seed, massstab, oktaven, lakunaritaet, basis, form], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const land = useMemo(() => z.reduce((s, v) => s + (v >= meer ? 1 : 0), 0) / z.length, [z, meer]);

  return (
    <Rahmen
      einstellungen={<>
        <Regler label="Maßstab" wert={massstab} min={1} max={12} schritt={0.5} setWert={setMassstab} />
        <Regler label="Oktaven" wert={oktaven} min={1} max={8} setWert={setOktaven} />
        <Regler label="Persistenz" wert={persistenz} min={0.2} max={0.8} schritt={0.05} setWert={setPersistenz} anzeige={persistenz.toFixed(2).replace(".", ",")} />
        <Regler label="Lakunarität" wert={lakunaritaet} min={1.5} max={3} schritt={0.1} setWert={setLakunaritaet} anzeige={lakunaritaet.toFixed(1).replace(".", ",")} />
        <Regler label="Domain Warping" wert={warp} min={0} max={3} schritt={0.1} setWert={setWarp} anzeige={warp.toFixed(1).replace(".", ",")} />
        <Regler label="Meeresspiegel" wert={meer} min={0} max={0.8} schritt={0.01} setWert={setMeer} anzeige={`${Math.round(meer * 100)} %`} />
        <label className="flex items-center gap-1"><input type="checkbox" checked={insel} onChange={e => setInsel(e.target.checked)} /> Insel</label>
        <select value={ansicht} onChange={e => setAnsicht(e.target.value as Ansicht)} className={auswahl}>
          <option value="karte">Landkarte</option>
          <option value="grau">Höhe als Grau</option>
        </select>
      </>}
      vertiefung={
        <Vertiefung
          code={CODE_GELAENDE}
          hintergrund={<>
            <p>
              Ken Perlin entwickelte sein Rauschen 1983, weil ihn die glatten, künstlichen Computerbilder im Film <i>Tron</i> störten. 1997 bekam er dafür einen Oscar für Technik.
              Fast jede Spielwelt mit Bergen (Minecraft, No Man's Sky) baut auf solchem Rauschen auf.
            </p>
            <p>
              <b>Wertrauschen</b> würfelt an den Gitterpunkten Höhen, <b>Gradientenrauschen</b> Richtungen. Wertrauschen zeigt die Kästchen des Gitters,
              Gradientenrauschen versteckt sie besser. Vergleiche die kleinen Oktavbilder.
            </p>
            <p>Die <b>Form</b> verändert jede Oktave: »Grat« faltet das Rauschen an der Null um und macht scharfe Bergkämme wie in den Alpen, »Wolken« runde Kuppen wie Haufenwolken oder Dünen.</p>
          </>}
          stellschrauben={<>
            <Wahl label="Rauschart" wert={basis} setWert={setBasis} optionen={[["gradient", "Gradientenrauschen (Perlin-Art)"], ["wert", "Wertrauschen"]]} />
            <Wahl label="Form je Oktave" wert={form} setWert={setForm} optionen={[["glatt", "glatt (Hügel)"], ["grat", "Grat (Bergkämme)"], ["wolken", "Wolken (Kuppen)"]]} />
            <Hinweis>»Grat« mit 6 Oktaven und Persistenz 0,5 sieht aus wie ein Hochgebirge</Hinweis>
            <Wahl label="Inselform" wert={inselForm} setWert={v => { setInselForm(v); setInsel(true); }} optionen={[["kreis", "rund"], ["quadrat", "eckig"]]} />
          </>}
        />
      }
      buehne={<>
        <Buehne b={256} h={256} takt={`${ablauf.takt}-${insel}-${meer}-${ansicht}-${inselForm}-${z.length && z[1000]}`} zeichne={ctx => male(ctx, z, 256, ansicht, meer)}
          klasse="max-w-[560px]" data-gelaende />
        <div className="flex flex-wrap gap-2 justify-center items-end" aria-label="einzelne Oktaven">
          {schichten.map((s, k) => (
            <figure key={k} className={`flex flex-col items-center text-[10px] text-muted ${k < o.oktaven ? "" : "opacity-30"}`}>
              <Buehne b={64} h={64} takt={`${seed}-${massstab}-${lakunaritaet}-${k}-${basis}-${form}`} zeichne={ctx => male(ctx, s, 64, "grau", 0)} klasse="w-14 rounded-md" />
              <span>{k + 1}: ×{Math.round(persistenz ** k * 100)} %</span>
            </figure>
          ))}
        </div>
        <Notiz ablauf={ablauf} />
        <Steuerung ablauf={ablauf} seed={seed} setSeed={setSeed} />
        <p className="text-xs text-center text-muted">Land: {Math.round(land * 100)} %</p>
      </>}
      erklaerung={<>
        <h3 className="font-black text-lg">Rauschen wird Landschaft</h3>
        <p>
          Würfelt man jede Höhe einzeln, entsteht nur Krisseln. <b>Gradientenrauschen</b> (wie das von Ken Perlin) würfelt dagegen nur an
          Gitterpunkten eine Richtung und blendet dazwischen weich über. So entstehen sanfte Hügel ohne Kanten.
        </p>
        <h4 className="font-bold">Oktaven</h4>
        <p>
          Echte Berge haben große Formen <i>und</i> kleine Zacken. Darum legt man mehrere Schichten übereinander. Jede ist feiner (<b>Lakunarität</b>, meist 2)
          und schwächer (<b>Persistenz</b>, meist 0,5). Unten siehst du die einzelnen Schichten. Abspielen legt sie nacheinander dazu.
        </p>
        <h4 className="font-bold">Domain Warping</h4>
        <p>
          Hier wird nicht an der Stelle (x, y) nachgeschaut, sondern ein Stück daneben. Wie weit, sagt noch einmal ein Rauschen.
          Die Landschaft wird verbogen wie Marmor oder geschmolzenes Wachs, Flusstäler und Bergrücken werden geschwungen.
        </p>
        <h4 className="font-bold">Insel und Meer</h4>
        <p>Die Inselmaske senkt das Gelände zum Rand hin ab. Der Meeresspiegel entscheidet, welche Höhen Wasser, Strand, Wiese, Wald, Fels oder Schnee werden.</p>
        <Frage>Stelle Oktaven auf 1, dann auf 8: Ab welcher Oktave siehst du keinen Unterschied mehr? (Tipp: Das Bild hat nur 256 Pixel.) Was passiert mit Persistenz 0,8?</Frage>
        <p className="text-xs text-muted">Wie Regen so ein Gelände formt, zeigt die Simulation <Link className="underline" href="/simulationen/erosion">Erosion</Link>.</p>
      </>}
    />
  );
}
