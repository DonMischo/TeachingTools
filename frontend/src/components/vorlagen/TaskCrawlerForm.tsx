"use client";
/** Formular für einen TaskCrawler (intern: Exitgame) im Upload-Format. */
import { useQuery } from "@tanstack/react-query";
import { api, type ExitGameData, type ExitGameSlide, type ExitGameTask } from "@/lib/api";
import { AntwortListe, BildFeld, Feld, Gruppe, Karte, ListenFeld, TextListe, ZeilenKnoepfe, eindeutigeId, move } from "./felder";
import { LEERES_ZEITSTRAHL_SPIEL, ZeitstrahlSpielForm } from "./ZeitstrahlSpielForm";
import { KarteFrageForm, LEERE_KARTE } from "./KarteFrageForm";
import { mediaUrl } from "@/components/exitgame/FolienTeile";
import { ChallengeForm, type ChallengeJson } from "./ChallengeForm";
import { SPIELARTEN } from "@/lib/challenge/spielarten";
import { THEMES } from "@/lib/challenge/themes";

/** Bild hochladen (landet in data/exitgames/{id}/assets) und Vorschau-Adresse. */
type Bilder = { upload: (file: File) => Promise<{ path: string }>; url: (src: string) => string };

type Data = ExitGameData & { description?: string | null; grade?: string | null; tags?: string[] };

const FOLIEN_TYPEN: [ExitGameSlide["type"], string, string][] = [
  ["explanation", "📖", "Erklärung"],
  ["example", "💡", "Beispiel"],
  ["task", "✏️", "Aufgabe"],
  ["door", "🚪", "Tür (Abschnittsende)"],
  ["boss", "⚔️", "Boss (Challenge)"],
];

const BOSS_SKINS: [string, string][] = [["monster", "Monster"], ["rap", "Rapper"], ["prinzessin", "Prinzessin"], ["einhorn", "Einhorn"]];

const AUFGABEN_ARTEN: [ExitGameTask["kind"], string][] = [
  ["single", "Eine richtige Antwort"],
  ["multi", "Mehrere richtige Antworten"],
  ["true_false", "Wahr oder falsch"],
  ["input", "Eingabe (Antwort eintippen)"],
  ["timeline", "Zeitstrahl"],
  ["karte", "Karte (benennen/finden)"],
];

export function neueAufgabe(kind: ExitGameTask["kind"] = "single", alt?: ExitGameTask): ExitGameTask {
  const base: ExitGameTask = { ...alt, kind };
  delete base.answers; delete base.accept; delete base.timeline; delete base.karte;
  if (kind === "single" || kind === "multi") {
    const antworten = alt?.answers?.length && alt.kind !== "true_false" ? alt.answers : [{ text: "", correct: true }, { text: "", correct: false }];
    base.answers = antworten.map(a => ({ ...a, correct: !!a.correct }));
  } else if (kind === "true_false") {
    base.answers = [{ text: "Wahr", correct: true }, { text: "Falsch", correct: false }];
  } else if (kind === "input") {
    base.accept = alt?.accept ?? [""];
  } else if (kind === "karte") {
    base.karte = alt?.karte ?? { ...LEERE_KARTE, mindestens: 1 };
  } else {
    base.timeline = alt?.timeline ?? structuredClone(LEERES_ZEITSTRAHL_SPIEL);
  }
  return base;
}

const ANSICHT_NAMEN: Record<string, string> = {
  folien: "Folien (klassisch)", gebaeude: "Gebäude", verlies: "Verlies", ebene: "Ebene",
};

type Katalog = {
  ansichten: Record<string, string>;
  stile: Record<string, string>;
  objekte: Record<string, string>;
  werkzeuge: Record<string, { name: string; config?: Record<string, string>; hinweis?: string }>;
};

/** Werkzeug-Einstellung als Text anzeigen, beim Tippen wieder in Zahl/Objekt wandeln. */
function alsText(v: unknown): string {
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}
function ausText(t: string): unknown {
  if (t.trim() === "") return undefined;
  if (/^-?\d+(\.\d+)?$/.test(t.trim())) return Number(t);
  if (/^[[{]/.test(t.trim())) { try { return JSON.parse(t); } catch { /* noch unfertig getippt */ } }
  return t;
}

function AufgabeForm({ task, onChange, katalog, name, leichter = true }: {
  task: ExitGameTask; onChange: (t: ExitGameTask) => void; katalog?: Katalog; name: string; leichter?: boolean;
}) {
  const sim = task.sim;
  const werkzeug = sim ? katalog?.werkzeuge[sim.tool] : undefined;
  return (
    <div className="flex flex-col gap-3">
      <Feld label="Aufgabenart">
        <select className="input" value={task.kind} onChange={e => onChange(neueAufgabe(e.target.value as ExitGameTask["kind"], task))}>
          {AUFGABEN_ARTEN.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </Feld>
      <Feld label="Frage" hint="Formeln mit $…$, z. B. $3x + 4 = 19$">
        <textarea className="input" rows={2} value={task.question ?? ""} onChange={e => onChange({ ...task, question: e.target.value })} />
      </Feld>

      {(task.kind === "single" || task.kind === "multi") && (
        <Gruppe label="Antworten">
          <AntwortListe name={name} mode={task.kind} answers={task.answers ?? []} onChange={answers => onChange({ ...task, answers })} />
        </Gruppe>
      )}
      {task.kind === "true_false" && (
        <Gruppe label="Richtig ist">
          <div className="flex gap-4">
            {(task.answers ?? []).map((a, j) => (
              <label key={j} className="flex items-center gap-2">
                <input type="radio" name={name} checked={!!a.correct} className="accent-green-600"
                  onChange={() => onChange({ ...task, answers: (task.answers ?? []).map((x, k) => ({ ...x, correct: k === j })) })} />
                {a.text}
              </label>
            ))}
          </div>
        </Gruppe>
      )}
      {task.kind === "input" && (
        <Gruppe label="Akzeptierte Antworten" hint="Jede Schreibweise, die als richtig zählen soll (Groß/Klein egal).">
          <TextListe values={task.accept ?? []} onChange={accept => onChange({ ...task, accept })} what="Antwort" addLabel="+ weitere Schreibweise" />
        </Gruppe>
      )}
      {task.kind === "timeline" && (
        <ZeitstrahlSpielForm spec={task.timeline ?? LEERES_ZEITSTRAHL_SPIEL} onChange={timeline => onChange({ ...task, timeline })} />
      )}
      {task.kind === "karte" && (
        <KarteFrageForm karte={task.karte ?? LEERE_KARTE} mitMindestens onChange={karte => onChange({ ...task, karte })} />
      )}

      <Feld label="Codeschnipsel (optional)" hint="Wer die Aufgabe löst, bekommt ihn. Die Schnipsel eines Abschnitts ergeben zusammen den Türcode.">
        <input className="input w-48 font-mono" value={task.codeFragment ?? ""}
          onChange={e => onChange({ ...task, codeFragment: e.target.value || undefined })} />
      </Feld>

      {katalog && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label="Werkzeug zum Ausprobieren (optional)" hint={werkzeug?.hinweis}>
            <select className="input" value={sim?.tool ?? ""}
              onChange={e => onChange({ ...task, sim: e.target.value ? { tool: e.target.value, config: {} } : undefined })}>
              <option value="">— kein Werkzeug —</option>
              {Object.entries(katalog.werkzeuge).map(([k, w]) => <option key={k} value={k}>{w.name}</option>)}
            </select>
          </Feld>
          {sim && werkzeug?.config && Object.entries(werkzeug.config).map(([key, beschreibung]) => {
            const k = key.replace(/\?$/, "");
            return (
              <Feld key={k} label={`Einstellung »${k}«`} hint={beschreibung}>
                <input className="input text-sm" defaultValue={alsText(sim.config?.[k])}
                  onBlur={e => {
                    const config = { ...sim.config };
                    const v = ausText(e.target.value);
                    if (v === undefined) delete config[k]; else config[k] = v;
                    onChange({ ...task, sim: { ...sim, config } });
                  }} />
              </Feld>
            );
          })}
        </div>
      )}

      {task.variants && (
        <p className="text-xs text-muted">
          Diese Aufgabe hat {task.variants.length} Varianten — die lassen sich im Expertenmodus bearbeiten.
        </p>
      )}

      {leichter && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!task.easierAlternative}
              onChange={e => onChange({ ...task, easierAlternative: e.target.checked ? neueAufgabe(task.kind) : undefined })} />
            Leichtere Ersatzaufgabe anbieten (wenn jemand hängt)
          </label>
          {task.easierAlternative && (
            <div className="ml-6 pl-3 border-l-2 border-line">
              <AufgabeForm task={task.easierAlternative} name={`${name}-leichter`} katalog={katalog} leichter={false}
                onChange={easierAlternative => onChange({ ...task, easierAlternative })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Boss-Folie: Spielart, Aussehen und der Challenge-Satz (liegt in slide.challenge, die Überschrift in slide.title). */
function BossForm({ slide, onChange, exitgameId }: { slide: ExitGameSlide; onChange: (s: ExitGameSlide) => void; exitgameId?: number }) {
  const spiel = slide.spiel ?? "boss";
  const spiele = slide.spiele ?? [spiel];
  const waehle = (id: string) => {
    const neu = spiele.includes(id) ? spiele.filter(x => x !== id) : [...spiele, id];
    if (neu.length) onChange({ ...slide, spiele: neu.length > 1 ? neu : undefined, spiel: neu.includes(spiel) ? spiel : neu[0] });
  };
  const { title: _t, ...satz } = { title: slide.title || "Boss", ...slide.challenge } as ChallengeJson;
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label="Spielart zu Beginn">
          <select className="input" value={spiel} onChange={e => onChange({ ...slide, spiel: e.target.value, spiele: spiele.includes(e.target.value) ? slide.spiele : [...spiele, e.target.value] })}>
            {SPIELARTEN.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </select>
        </Feld>
        <Feld label="Erlaubte Spielarten" hint="zum Wechseln">
          <div className="flex flex-wrap gap-1">
            {SPIELARTEN.map(s => (
              <button key={s.id} type="button" aria-pressed={spiele.includes(s.id)} onClick={() => waehle(s.id)}
                className={`chip ${spiele.includes(s.id) ? "chip-on" : ""}`}>{s.icon} {s.name}</button>
            ))}
          </div>
        </Feld>
        <Feld label="Boss-Aussehen">
          <select className="input" value={slide.skin ?? "monster"} onChange={e => onChange({ ...slide, skin: e.target.value })}>
            {BOSS_SKINS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Feld>
        <Feld label="Theme">
          <select className="input" value={slide.theme ?? "klassisch"} onChange={e => onChange({ ...slide, theme: e.target.value })}>
            {Object.entries(THEMES).map(([v, t]) => <option key={v} value={v}>{t.name}</option>)}
          </select>
        </Feld>
        <Feld label="Startstufe">
          <select className="input" value={slide.startstufe ?? 2} onChange={e => onChange({ ...slide, startstufe: Number(e.target.value) })}>
            {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Feld>
        <Feld label="Etappen">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={slide.etappenMischen === true} onChange={e => onChange({ ...slide, etappenMischen: e.target.checked })} />
            Etappen in zufälliger Reihenfolge
          </label>
        </Feld>
        <Feld label="Codeschnipsel" hint="für die Tür; leer = keiner">
          <input className="input font-mono" value={slide.codeFragment ?? ""}
            onChange={e => onChange({ ...slide, codeFragment: e.target.value || undefined })} />
        </Feld>
      </div>
      <ChallengeForm value={satz as ChallengeJson} satzId={exitgameId ?? 0}
        upload={file => exitgameId === undefined ? Promise.reject(new Error("Erst speichern")) : api.exitgame.uploadAsset(exitgameId, file)}
        urlFor={exitgameId === undefined ? undefined : p => mediaUrl(p, exitgameId)}
        onChange={v => { const { title: _x, ...rest } = v; onChange({ ...slide, challenge: rest }); }} />
    </>
  );
}

function FolieForm({ slide, slides, onChange, katalog, name, bilder, exitgameId }: {
  slide: ExitGameSlide; slides: ExitGameSlide[]; onChange: (s: ExitGameSlide) => void; katalog?: Katalog; name: string; bilder?: Bilder; exitgameId?: number;
}) {
  const hatAufgaben = slide.type === "task" || slide.type === "door";
  const tasks = slide.tasks ?? (slide.task ? [slide.task] : []);
  // Mehrere Aufgaben stehen in »tasks«, eine einzelne in »task« — wie beim Hochladen.
  const setTasks = (list: ExitGameTask[]) => {
    const next = { ...slide };
    delete next.task; delete next.tasks;
    if (list.length === 1) next.task = list[0];
    else if (list.length > 1) next.tasks = list;
    onChange(next);
  };
  const andere = slides.filter(s => s.id !== slide.id && s.type !== "door");

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <Feld label="Art">
          <select className="input" value={slide.type}
            onChange={e => {
              const type = e.target.value as ExitGameSlide["type"];
              const next = { ...slide, type };
              if (type === "task" && !slide.task && !slide.tasks) next.task = neueAufgabe();
              if (type === "boss") {
                delete next.task; delete next.tasks; delete next.hints; delete next.onFailReview;
                next.challenge = slide.challenge ?? { facts: [], challenges: [] };
              }
              // Erklärung/Beispiel haben keine Aufgaben.
              if (type === "explanation" || type === "example") {
                delete next.task; delete next.tasks; delete next.hints; delete next.onFailReview;
              }
              onChange(next);
            }}>
            {FOLIEN_TYPEN.map(([v, icon, l]) => <option key={v} value={v}>{icon} {l}</option>)}
          </select>
        </Feld>
        <Feld label="Überschrift">
          <input className="input" value={slide.title ?? ""} onChange={e => onChange({ ...slide, title: e.target.value })} />
        </Feld>
        <Feld label="Kennung" hint="für Verweise">
          <input className="input w-32 font-mono text-xs" value={slide.id} onChange={e => onChange({ ...slide, id: e.target.value.trim() })} />
        </Feld>
      </div>

      <Feld label={slide.type === "door" ? "Text an der Tür" : "Text"} hint="Formeln mit $…$">
        <textarea className="input" rows={3} value={slide.text ?? ""} onChange={e => onChange({ ...slide, text: e.target.value })} />
      </Feld>

      {bilder && (
        <div className="flex flex-wrap gap-3 items-end">
          <BildFeld label="Bild (optional)" upload={bilder.upload} urlFor={bilder.url}
            value={slide.media?.kind === "image" ? slide.media.src : null}
            onChange={src => onChange({ ...slide, media: src ? { kind: "image", src, alt: slide.media?.alt } : undefined })} />
          {slide.media?.kind === "image" && (
            <Feld label="Bildbeschreibung (für Vorlesehilfen)" className="flex-1 min-w-48">
              <input className="input text-sm" value={slide.media.alt ?? ""}
                onChange={e => onChange({ ...slide, media: { ...slide.media!, alt: e.target.value || undefined } })} />
            </Feld>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Feld label={bilder ? "… oder Adresse eines Bildes/Videos" : "Bild oder Video (optional)"} hint="z. B. ein YouTube-Link">
          <input className="input text-sm" value={slide.media?.src ?? ""}
            onChange={e => {
              const src = e.target.value.trim();
              const kind = /youtu|vimeo|\.mp4$/i.test(src) ? "video" : slide.media?.kind === "html" ? "html" : "image";
              onChange({ ...slide, media: src ? { ...slide.media, kind, src } as ExitGameSlide["media"] : undefined });
            }} />
        </Feld>
        {katalog && (
          <Feld label="Objekt im Zimmer (Gebäude-Ansicht)" hint={slide.station ? katalog.objekte[slide.station] : "ohne Angabe passend zur Art"}>
            <select className="input" value={slide.station ?? ""} onChange={e => onChange({ ...slide, station: e.target.value || undefined })}>
              <option value="">— automatisch —</option>
              {Object.entries(katalog.objekte).map(([k, l]) => <option key={k} value={k}>{l.split(/ \(| —/)[0]}</option>)}
            </select>
          </Feld>
        )}
      </div>

      {slide.type === "boss" && <BossForm slide={slide} onChange={onChange} exitgameId={exitgameId} />}

      {slide.type === "door" && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={tasks.length > 0}
            onChange={e => setTasks(e.target.checked ? [neueAufgabe("input")] : [])} />
          Eigene Türfrage stellen (sonst öffnet der Code aus den Codeschnipseln die Tür)
        </label>
      )}

      {hatAufgaben && tasks.map((t, j) => (
        <div key={j} className="rounded-lg border border-line p-3 flex flex-col gap-2">
          {tasks.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold flex-1">Teilaufgabe {j + 1}</span>
              <ZeilenKnoepfe index={j} count={tasks.length} what="Teilaufgabe"
                onMove={d => setTasks(move(tasks, j, d))} onRemove={() => setTasks(tasks.filter((_, k) => k !== j))} />
            </div>
          )}
          <AufgabeForm task={t} name={`${name}-a${j}`} katalog={katalog} onChange={nt => setTasks(tasks.map((x, k) => k === j ? nt : x))} />
        </div>
      ))}
      {slide.type === "task" && (
        <button type="button" className="text-xs text-accent hover:underline self-start"
          onClick={() => setTasks([...tasks, neueAufgabe()])}>
          + weitere Teilaufgabe auf dieser Folie
        </button>
      )}

      {hatAufgaben && (
        <>
          <Gruppe label="Hinweise" hint="Werden nacheinander freigeschaltet, wenn jemand nicht weiterkommt.">
            <TextListe values={slide.hints ?? []} onChange={hints => onChange({ ...slide, hints: hints.length ? hints : undefined })}
              what="Hinweis" addLabel="+ Hinweis" />
          </Gruppe>
          {andere.length > 0 && (
            <Gruppe label="Bei Fehlern zurückschicken zu" hint="Folien, die man sich nach einer falschen Antwort noch einmal ansehen soll.">
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {andere.map(s => (
                  <label key={s.id} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={(slide.onFailReview ?? []).includes(s.id)}
                      onChange={e => {
                        const list = (slide.onFailReview ?? []).filter(x => x !== s.id);
                        if (e.target.checked) list.push(s.id);
                        onChange({ ...slide, onFailReview: list.length ? list : undefined });
                      }} />
                    {s.title || s.id}
                  </label>
                ))}
              </div>
            </Gruppe>
          )}
        </>
      )}

      <Feld label="Merksatz für die Ergebnissicherung (optional)" hint="Steht am Ende im PDF zum Mitnehmen.">
        <textarea className="input" rows={2} value={slide.ergebnissicherung ?? ""}
          onChange={e => onChange({ ...slide, ergebnissicherung: e.target.value || undefined })} />
      </Feld>
    </>
  );
}

export function TaskCrawlerForm({ value, onChange, exitgameId }: { value: Data; onChange: (v: Data) => void; exitgameId?: number }) {
  const bilder: Bilder | undefined = exitgameId === undefined ? undefined : {
    upload: file => api.exitgame.uploadAsset(exitgameId, file),
    url: src => mediaUrl(src, exitgameId),
  };
  const { data: katalog } = useQuery<Katalog>({ queryKey: ["exitgame-katalog"], queryFn: api.exitgame.katalog, staleTime: Infinity });
  const set = (patch: Partial<Data>) => onChange({ ...value, ...patch });
  const slides = value.slides;
  const setSlides = (s: ExitGameSlide[]) => set({ slides: s });
  const typ = Object.fromEntries(FOLIEN_TYPEN.map(([v, icon, l]) => [v, `${icon} ${l}`]));

  function addSlide(type: ExitGameSlide["type"]) {
    const s: ExitGameSlide = { id: eindeutigeId(type === "door" ? "tuer" : type === "task" ? "aufgabe" : "folie", slides.map(x => x.id)), type, title: "", text: "" };
    if (type === "task") s.task = neueAufgabe();
    if (type === "boss") s.challenge = { facts: [], challenges: [] };
    setSlides([...slides, s]);
  }

  // Abschnitte zählen: jede Tür beendet einen.
  let abschnitt = 1;

  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <Feld label="Titel *" className="sm:col-span-2">
          <input className="input" value={value.title} onChange={e => set({ title: e.target.value })} />
        </Feld>
        <Feld label="Beschreibung" className="sm:col-span-2">
          <input className="input" value={value.description ?? ""} onChange={e => set({ description: e.target.value || null })} />
        </Feld>
        <Feld label="Fach *"><input className="input" value={value.subject} onChange={e => set({ subject: e.target.value })} /></Feld>
        <Feld label="Klassenstufe(n)"><input className="input" value={value.grade ?? ""} placeholder="z. B. 7,8" onChange={e => set({ grade: e.target.value || null })} /></Feld>
        <Feld label="Schlagwörter" hint="durch Kommas getrennt" className="sm:col-span-2">
          <ListenFeld value={value.tags ?? []} onChange={tags => set({ tags })} />
        </Feld>
      </section>

      {katalog && (
        <section className="grid gap-3 sm:grid-cols-2">
          <Feld label="Ansicht" hint={katalog.ansichten[value.gebaeude?.ansicht ?? "folien"]}>
            <select className="input" value={value.gebaeude?.ansicht ?? "folien"}
              onChange={e => set({ gebaeude: { ...value.gebaeude, ansicht: e.target.value as NonNullable<Data["gebaeude"]>["ansicht"] } })}>
              {Object.keys(katalog.ansichten).map(k => <option key={k} value={k}>{ANSICHT_NAMEN[k] ?? k}</option>)}
            </select>
          </Feld>
          {value.gebaeude?.ansicht && value.gebaeude.ansicht !== "folien" && (
            <Feld label="Baustil" hint={value.gebaeude?.stil ? katalog.stile[value.gebaeude.stil] : "Standard der Ansicht"}>
              <select className="input" value={value.gebaeude?.stil ?? ""}
                onChange={e => set({ gebaeude: { ...value.gebaeude, stil: e.target.value || undefined } })}>
                <option value="">— Standard —</option>
                {Object.keys(katalog.stile).map(k => <option key={k} value={k}>{k[0].toUpperCase() + k.slice(1)}</option>)}
              </select>
            </Feld>
          )}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm">Ablauf ({slides.length} Folien)</h3>
        <p className="text-xs text-muted">
          Eine Tür schließt einen Abschnitt ab. Ihren Code bilden die Codeschnipsel der Aufgaben davor — oder sie stellt eine eigene Frage.
        </p>
        {slides.map((s, i) => {
          const header = i === 0 || slides[i - 1].type === "door"
            ? <div className="text-xs font-semibold uppercase tracking-wide text-muted mt-2">Abschnitt {abschnitt}</div> : null;
          if (s.type === "door") abschnitt++;
          return (
            <div key={i} className="flex flex-col gap-2">
              {header}
              <Karte offen={!s.title && !s.text}
                titel={<>{typ[s.type]} · {s.title || <em className="text-muted">ohne Überschrift</em>}</>}
                knoepfe={<ZeilenKnoepfe index={i} count={slides.length} what="Folie"
                  onMove={d => setSlides(move(slides, i, d))}
                  onRemove={() => confirm(`»${s.title || s.id}« löschen?`) && setSlides(
                    slides.filter((_, j) => j !== i)
                      .map(x => x.onFailReview ? { ...x, onFailReview: x.onFailReview.filter(id => id !== s.id) } : x))} />}>
                <FolieForm slide={s} slides={slides} katalog={katalog} name={`folie-${i}`} bilder={bilder} exitgameId={exitgameId}
                  onChange={ns => setSlides(slides.map((x, j) => {
                    if (j === i) return ns;
                    // Kennung umbenannt: Verweise mitziehen.
                    return ns.id !== s.id && x.onFailReview?.includes(s.id)
                      ? { ...x, onFailReview: x.onFailReview.map(id => id === s.id ? ns.id : id) } : x;
                  }))} />
              </Karte>
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {FOLIEN_TYPEN.map(([v, icon, l]) => (
            <button key={v} type="button" onClick={() => addSlide(v)}
              className="text-sm px-3 py-1.5 rounded-lg border border-line hover:border-accent">
              + {icon} {l}
            </button>
          ))}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Feld label="Text am Ende" hint="Wird gezeigt, wenn alles geschafft ist.">
          <input className="input" value={value.completion?.message ?? ""}
            onChange={e => set({ completion: { ...value.completion, message: e.target.value } })} />
        </Feld>
        <Feld label="Abschlusscode (optional)" hint="z. B. zum Vorzeigen bei der Lehrkraft">
          <input className="input font-mono" value={value.completion?.code ?? ""}
            onChange={e => set({ completion: { ...value.completion, code: e.target.value || undefined } })} />
        </Feld>
      </section>
    </div>
  );
}
