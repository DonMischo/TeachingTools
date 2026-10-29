"use client";
/**
 * Dieselbe Woche auf Jonas' Handy. Kein Kommentar, nur was bei ihm ankam —
 * auch das, was man selbst getan (oder nicht getan) hat.
 */
import { useState } from "react";
import { JONAS_OPTIONEN, TAGE, istGewaehlt } from "@/lib/klikk/geschichte";
import { MITTERNACHT, zeit } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";
import { Rahmen } from "./Handy";

interface Zeile { tag: number; uhr: number; text: string; art: "push" | "jonas" | "du" | "still" }

const u = (h: number, m = 0) => h * 60 + m;

/** Hat die Person die Nachricht mit dieser Wahl gelesen? */
function gelesen(s: Stand, wahlId: string) {
  for (const c of Object.values(s.chats)) for (const n of c) if (n.wahl?.id === wahlId) return s.gelesen.includes(n.id);
  return false;
}

export function jonasWoche(s: Stand): Zeile[] {
  const z: Zeile[] = [];
  const reaktion = (tag: number, uhr: number, wahlId: string, texte: Record<string, string>) => {
    const g = istGewaehlt(s, wahlId);
    if (g && g !== "still" && texte[g]) z.push({ tag, uhr, text: texte[g], art: "du" });
    else if (gelesen(s, wahlId)) z.push({ tag, uhr, text: "Gelesen ✓✓ — auch von dir. Du hast nichts geschrieben.", art: "still" });
  };

  z.push({ tag: 0, uhr: u(15, 10), text: "8b 🔥 · Finn: 📷 Foto — »😂😂😂 guckt mal wer im bus pennt«", art: "push" });
  z.push({ tag: 0, uhr: u(15, 11), text: "8b 🔥 · Emma: LMAOOO · Ben: 💀💀", art: "push" });
  reaktion(0, u(15, 12), "bus", { lachen: "8b 🔥 · du: 😂😂", stopp: "8b 🔥 · du: »Lasst das mal, das ist fies.« — Jonas schaut lange auf deinen Namen." });
  z.push({ tag: 0, uhr: u(22, 30), text: "Jonas tippt in die Gruppe: »warum macht ihr das« … und löscht es wieder.", art: "jonas" });

  z.push({ tag: 1, uhr: u(15, 40), text: "8b 🔥 · Ben: Sticker 💤 — sein Gesicht mit »ZZZ«", art: "push" });
  z.push({ tag: 1, uhr: u(15, 42), text: "Klikk: @jonas_schnarcht erwähnt dich in einem Beitrag.", art: "push" });
  reaktion(1, u(15, 50), "account", {
    folgen: "Klikk: @jonas_schnarcht hat jetzt 31 Follower. Einer davon bist du.",
    melden: "Jemand hat @jonas_schnarcht gemeldet. Klikk hat »keinen Verstoß festgestellt«. Der Account bleibt.",
  });
  z.push({ tag: 1, uhr: u(19, 0), text: "Jonas löscht sein Profilbild.", art: "jonas" });

  z.push({ tag: 2, uhr: u(15, 20), text: "Klikk: 14 neue Kommentare zu deinem Video 🎸 — »schnarch 💤«, »sticker > lied«, »geh schlafen«", art: "push" });
  reaktion(2, u(15, 25), "kommentar", {
    liken: "Klikk: du gefällt »schnarch 💤«. Er sieht deinen Namen unter dem Kommentar.",
    nett: "Klikk: Neuer Kommentar — »Klingt echt gut!« Jonas liest ihn fünfmal. Es ist der einzige nette.",
  });
  z.push({ tag: 2, uhr: u(22, 0), text: "Jonas ändert seinen Status: »einfach alles egal«.", art: "jonas" });

  z.push({ tag: 3, uhr: u(3, 12), text: "Jonas liegt wach und scrollt durch die Sticker, die über ihn rumgehen.", art: "jonas" });
  z.push({ tag: 3, uhr: u(6, 50), text: "Entwurf an Mama: »kann ich heute zuhause bleiben, mir ist schlecht« — gelöscht. Er geht doch.", art: "jonas" });
  z.push({ tag: 3, uhr: u(16, 20), text: "8b 🔥 · Sara: 📊 Umfrage — »wer ist der größte loser der 8b?« · Jonas: 14 Stimmen", art: "push" });
  reaktion(3, u(16, 22), "umfrage", {
    jonas: "📊 Jonas: 15 Stimmen. Eine davon ist deine.",
    screenshot: "Jonas weiß es noch nicht: Jemand hat Frau Yilmaz die Umfrage gezeigt.",
  });
  z.push({ tag: 3, uhr: u(16, 45), text: "Jonas verlässt die Gruppe. Gleich danach: Finn — »rage quit 😂😂« (sieht er trotzdem, weil Emma es ihm schickt).", art: "jonas" });
  z.push({ tag: 3, uhr: u(21, 0), text: "Jonas stellt sein Konto auf privat und löscht alle Videos. Auch das mit der Gitarre.", art: "jonas" });

  for (const o of JONAS_OPTIONEN) {
    const t = Number(s.flags[`jonas_${o.id}_zeit`] ?? -1);
    if (t < 0) continue;
    const tag = Math.floor(t / MITTERNACHT), uhr = t % MITTERNACHT;
    z.push({ tag, uhr, text: `Nachricht von dir: »${o.text}«`, art: "du" });
    z.push({ tag, uhr: uhr + 1, text: o.id === "j1" ? "Jonas starrt eine Weile auf die Nachricht, bevor er antwortet." : `Jonas antwortet: »${o.antwort({ ...s, tag })}«`, art: "jonas" });
  }

  const ausgang = s.flags.jonasAusgang;
  z.push({
    tag: 4, uhr: u(7, 30), art: "jonas",
    text: ausgang === 2 ? "Jonas geht zur Schule. Frau Yilmaz wartet schon an der Tür. Zum ersten Mal seit Montag ist er nicht allein damit."
      : ausgang === 1 ? "Jonas geht zur Schule. Er hat eine einzige Nachricht, an die er denkt — deine."
      : "Jonas bleibt im Bett. Seine Mutter ruft in der Schule an. Er sagt ihr nicht, warum.",
  });
  return z.sort((a, b) => a.tag * MITTERNACHT + a.uhr - (b.tag * MITTERNACHT + b.uhr));
}

export default function JonasSicht({ s, weiter }: { s: Stand; weiter: () => void }) {
  const zeilen = jonasWoche(s);
  const [n, setN] = useState(1);
  const sichtbar = zeilen.slice(0, n);
  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
      <Rahmen uhr={zeit(sichtbar[sichtbar.length - 1].uhr)} dunkel>
        <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
          <div className="text-center text-xs text-neutral-400 mb-2">🎸 Jonas&apos; Handy</div>
          {sichtbar.map((z, i) => (
            <div key={i}>
              {(i === 0 || sichtbar[i - 1].tag !== z.tag) && <div className="text-center text-[11px] text-neutral-500 my-2">{TAGE[z.tag]}</div>}
              <div className={`rounded-2xl px-3 py-2 text-sm ${
                z.art === "du" ? "bg-amber-400 text-neutral-950 font-bold" : z.art === "still" ? "bg-neutral-800 text-amber-300 italic"
                : z.art === "jonas" ? "text-neutral-400 italic px-1" : "bg-neutral-800"}`}>
                <span className="text-[10px] opacity-70 mr-1">{zeit(z.uhr)}</span>{z.text}
              </div>
            </div>
          ))}
        </div>
      </Rahmen>
      <div className="card p-5 flex flex-col gap-3">
        <h2 className="text-xl font-black">Dieselbe Woche. Anderes Handy.</h2>
        <p className="text-sm text-muted">Gelb ist alles, was von dir kam — auch dein Schweigen, wenn du es gelesen hast.</p>
        {n < zeilen.length
          ? <button className="btn-primary self-start" onClick={() => setN(x => x + 1)}>Weiter ({n}/{zeilen.length})</button>
          : <button className="btn-primary self-start" onClick={weiter}>🪞 Zum Datenspiegel</button>}
        {n < zeilen.length && <button className="text-xs text-muted underline self-start" onClick={() => setN(zeilen.length)}>Alles zeigen</button>}
      </div>
    </div>
  );
}
