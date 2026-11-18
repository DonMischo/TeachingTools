"use client";
/**
 * Teil 4 · Apps installieren: Store öffnen, suchen, unter drei Treffern die
 * passende App erkennen (Altersfreigabe, Entwickler, Bewertungen, Daten),
 * die Datenschutz-Angaben ansehen, mit Erlaubnis der Eltern installieren,
 * ein Kaufangebot ablehnen und eine alte App löschen.
 *
 * Kinderkonten fragen beim Installieren die Eltern: Android über Family Link
 * (»Genehmigung anfordern«), iPhone über die Familienfreigabe (»Kaufanfrage«).
 */
import { useRef, useState } from "react";
import type { StufenErgebnis } from "@/lib/maus/ergebnis";
import { STORE_NAME, storeTreffer, type StoreApp } from "@/lib/maus/mobil";
import { useAufgabenStufe } from "../aufgabenStufe";
import { useMausKontext } from "../MausKontext";
import { DemoBuehne, mitte, useDemo, type DemoSchritt } from "../Demo";
import { Handy, MobilRahmen, Startbildschirm, type StartApp } from "./Handy";

const AUFGABEN = [
  "Store öffnen",
  "Nach »malen« suchen",
  "Die passende App öffnen",
  "Datenschutz-Angaben ansehen",
  "Mit Erlaubnis installieren",
  "Kaufangebot ablehnen",
  "Alte App löschen",
];

type Ansicht = "home" | "store" | "detail" | "daten" | "app";

export default function StufeAppStore({ avatar, onFertig, onWeiter }: { avatar: string; onFertig: (e: StufenErgebnis) => void; onWeiter: () => void }) {
  const { handy: system } = useMausKontext();
  const ios = system === "ios";
  const store = STORE_NAME[system];
  const { schritt, setFehler, hinweis, setHinweis, fertig, weiterMit, punkte } = useAufgabenStufe("appstore", AUFGABEN.length, onFertig);
  const [ansicht, setAnsicht] = useState<Ansicht>("home");
  const [suche, setSuche] = useState("");
  const [gewaehlt, setGewaehlt] = useState<StoreApp | null>(null);
  const [frage, setFrage] = useState<"frage" | "wartet" | null>(null);
  const [installiert, setInstalliert] = useState(false);
  const [angebot, setAngebot] = useState(true);
  const [lampe, setLampe] = useState(true);
  const [menue, setMenue] = useState<"menue" | "loeschen" | null>(null);
  const bildschirm = useRef<HTMLDivElement>(null);
  const demo = useDemo();

  const treffer = storeTreffer(suche);
  const akzent = ios ? "#007aff" : "#01875f";

  function falsch(text: string) {
    setFehler(f => f + 1);
    setHinweis({ text, gut: false });
  }

  const startApps: StartApp[] = [
    { id: "store", name: store, icon: ios ? "🅰️" : "▶️", farbe: ios ? "#0a84ff" : "#ffffff" },
    { id: "kamera", name: "Kamera", icon: "📷", farbe: "#374151" },
    { id: "fotos", name: "Fotos", icon: "🖼️", farbe: "#f472b6" },
    ...(lampe ? [{ id: "lampe", name: "Taschenlampe Plus", icon: "🔦", farbe: "#111827" }] : []),
    ...(installiert ? [{ id: "malblock", name: "Malblock Kids", icon: "🖌️", farbe: "#2563eb" }] : []),
  ];

  function appTipp(id: string) {
    if (fertig || demo.aktiv) return;
    if (id === "store") {
      setAnsicht("store");
      if (schritt === 0) weiterMit(true, `Der ${store} ist offen! ⭐`);
    } else if (id === "malblock") {
      setAnsicht("app");
    } else if (id === "lampe") {
      setHinweis({ text: schritt === 6 ? "Zum Löschen: das Symbol lange gedrückt halten." : "Die Taschenlampe ist gerade nicht dran.", gut: false });
    }
  }

  function lange(id: string) {
    if (fertig || demo.aktiv) return;
    if (id === "lampe") setMenue("menue");
    else setHinweis({ text: "Diese App behalten wir. Gesucht: »Taschenlampe Plus«.", gut: false });
  }

  function loeschen(ganz: boolean) {
    setMenue(null);
    if (!ganz) {
      setHinweis({ text: "Jetzt ist sie nur vom Home-Bildschirm weg, aber noch auf dem iPhone. Wähle »App löschen«.", gut: false });
      setMenue("menue");
      return;
    }
    setLampe(false);
    if (schritt === 6) weiterMit(true, "Weg damit! Alte Apps löschen spart Platz und schützt deine Daten. ⭐");
  }

  function suchEingabe(t: string) {
    setSuche(t);
    if (schritt === 1 && storeTreffer(t).length > 0) weiterMit(true, "Drei Treffer — schau sie dir genau an! ⭐");
  }

  function oeffne(a: StoreApp) {
    if (demo.aktiv) return;
    setGewaehlt(a);
    setAnsicht("detail");
    if (schritt === 2 && a.urteil.passt) weiterMit(true, "Gute Wahl — die passt! ⭐");
    else if (schritt === 2) setHinweis({ text: "Schau auf die rote Box: Diese App passt nicht. Geh zurück.", gut: false });
  }

  function datenAnsehen() {
    setAnsicht("daten");
    if (schritt === 3 && gewaehlt?.urteil.passt) weiterMit(true, "So siehst du, was eine App sammelt. ⭐");
  }

  function installieren() {
    if (!gewaehlt || demo.aktiv) return;
    if (!gewaehlt.urteil.passt) { falsch(`Halt! ${gewaehlt.urteil.gruende[0]}`); return; }
    if (schritt < 4) { setHinweis({ text: "Erst die Aufgaben davor — schau dir die Datenschutz-Angaben an.", gut: false }); return; }
    setFrage("frage");
  }

  function eltern(fragen: boolean) {
    if (!fragen) { setFrage(null); setHinweis({ text: "Ohne Erlaubnis geht es nicht. Frag deine Eltern!", gut: false }); return; }
    setFrage("wartet");
    setTimeout(() => {
      setFrage(null);
      setInstalliert(true);
      if (schritt === 4) weiterMit(true, "Deine Eltern haben Ja gesagt — installiert! ⭐");
    }, 1500);
  }

  function angebotWahl(kaufen: boolean) {
    if (demo.aktiv) return;
    if (kaufen) { falsch("Das kostet echtes Geld! Solche Angebote wollen dich hetzen. Schließ das Fenster."); return; }
    setAngebot(false);
    if (schritt === 5) weiterMit(true, "Richtig: Nein danke! ⭐");
  }

  function vorfuehren() {
    const ort = (sel: string) => () => mitte(bildschirm.current?.querySelector(sel) ?? null);
    const s: DemoSchritt[] = [];
    if (schritt === 0) s.push({ text: `Auf den ${store} tippen.`, zu: ort('[data-app-kachel="store"]'), taste: "links" });
    else if (schritt === 1) s.push({ text: "Ins Suchfeld tippen und »malen« schreiben.", zu: ort("[data-store-suche]"), tasten: ["KeyM", "KeyA", "KeyL"] });
    else if (schritt === 2) s.push({ text: "Prüfe: Alter? Entwickler? Viele Bewertungen? Erst dann antippen.", zu: ort('[data-store-app="malblock"]'), taste: null });
    else if (schritt === 3) s.push({ text: ios ? "Weiter unten: »App-Datenschutz«." : "Weiter unten: »Datensicherheit«.", zu: ort("[data-datenschutz]"), taste: "links" });
    else if (schritt === 4) s.push({ text: ios ? "Auf »Laden« tippen — dann fragt das iPhone deine Eltern." : "Auf »Installieren« tippen — dann fragt das Handy deine Eltern.", zu: ort("[data-installieren]"), taste: "links" });
    else if (schritt === 5) s.push({ text: "Nicht kaufen: auf »Nein danke« tippen.", zu: ort("[data-angebot-nein]"), taste: "links" });
    else s.push(
      { text: "Auf dem Startbildschirm das Symbol lange gedrückt halten …", zu: ort('[data-app-kachel="lampe"]'), taste: "halten" },
      { text: ios ? "… dann »App entfernen« und »App löschen«." : "… dann »Deinstallieren«.", taste: null },
    );
    demo.abspielen(s);
  }

  const zurueck = (ziel: Ansicht) => (
    <button type="button" data-zurueck onClick={() => setAnsicht(ziel)} className="font-bold text-[15px] px-3 py-2" style={{ color: akzent }}>
      {ios ? "‹ Zurück" : "←"}
    </button>
  );

  const freigabe = (a: StoreApp) => (ios ? a.ios : a.usk);

  let inhalt;
  if (ansicht === "home") {
    inhalt = <Startbildschirm system={system} apps={startApps} onApp={appTipp} onLange={lange} />;
  } else if (ansicht === "store") {
    inhalt = (
      <div className="absolute inset-0 overflow-y-auto bg-white text-[#111]" style={{ paddingTop: 48 }}>
        <div className="px-3 text-[24px] font-bold">{ios ? "Suchen" : store}</div>
        <input
          data-store-suche
          value={suche}
          onChange={e => suchEingabe(e.target.value)}
          placeholder={ios ? "Spiele, Apps und mehr" : "Nach Apps und Spielen suchen"}
          className="mx-3 my-2 w-[calc(100%-1.5rem)] rounded-full px-4 py-2 text-[14px] outline-hidden"
          style={{ background: "#eef0f3" }}
        />
        <div className="flex flex-col">
          {treffer.map(a => (
            <button key={a.id} type="button" data-store-app={a.id} onClick={() => oeffne(a)} className="flex items-center gap-3 px-3 py-2 text-left hover:bg-[#0000000a]">
              <span className="flex items-center justify-center text-2xl shrink-0" style={{ width: 52, height: 52, borderRadius: 13, background: a.farbe }}>{a.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-bold truncate" style={{ fontFamily: "Arial, sans-serif" }}>{a.name}</span>
                <span className="block text-[12px] text-[#5f6368] truncate">{a.entwickler}</span>
                <span className="block text-[12px] text-[#5f6368]">{a.sterne.toLocaleString("de-DE")} ★ · {freigabe(a)}</span>
              </span>
            </button>
          ))}
          {suche.trim().length >= 3 && treffer.length === 0 && <p className="px-4 py-6 text-sm text-[#5f6368]">Keine Treffer. Versuch »malen«.</p>}
        </div>
      </div>
    );
  } else if ((ansicht === "detail" || ansicht === "daten") && gewaehlt) {
    const a = gewaehlt;
    inhalt = (
      <div className="absolute inset-0 overflow-y-auto bg-white text-[#111]" style={{ paddingTop: 44 }}>
        {zurueck(ansicht === "daten" ? "detail" : "store")}
        {ansicht === "detail" ? (
          <div className="px-4 flex flex-col gap-3 pb-10">
            <div className="flex gap-3 items-center">
              <span className="flex items-center justify-center text-3xl shrink-0" style={{ width: 64, height: 64, borderRadius: 15, background: a.farbe }}>{a.icon}</span>
              <div className="min-w-0">
                <div className="text-[17px] font-bold" style={{ fontFamily: "Arial, sans-serif" }}>{a.name}</div>
                <div className="text-[13px]" style={{ color: akzent }}>{a.entwickler}</div>
                <div className="text-[11px] text-[#5f6368]">{[a.werbung && "Enthält Werbung", a.kaeufe && "In-App-Käufe"].filter(Boolean).join(" · ") || "Keine Werbung · keine Käufe"}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 text-center text-[12px] border-y border-[#e5e7eb] py-2">
              <span><b>{a.sterne.toLocaleString("de-DE")} ★</b><br />{a.bewertungen} Bew.</span>
              <span><b>{freigabe(a)}</b><br />Alter</span>
              <span><b>{a.downloads}</b><br />Downloads</span>
            </div>
            <button
              type="button"
              data-installieren
              onClick={installieren}
              disabled={installiert && a.urteil.passt}
              className="rounded-full py-2 font-bold text-white text-[14px]"
              style={{ background: installiert && a.urteil.passt ? "#9ca3af" : akzent }}
            >
              {installiert && a.urteil.passt ? "Installiert ✓" : ios ? "Laden" : "Installieren"}
            </button>
            {!a.urteil.passt && (
              <div className="rounded-xl border-2 border-[#dc2626] bg-[#fef2f2] p-3 text-[12px]" data-warnung>
                <b>⚠️ Achtung:</b>
                <ul className="list-disc pl-4">{a.urteil.gruende.map(g => <li key={g}>{g}</li>)}</ul>
              </div>
            )}
            <button type="button" data-datenschutz onClick={datenAnsehen} className="text-left rounded-xl bg-[#f3f4f6] p-3 text-[13px]">
              <b>{ios ? "App-Datenschutz" : "Datensicherheit"}</b> ›<br />
              <span className="text-[#5f6368]">{ios ? "Was die App über dich erfasst" : "So geht die App mit deinen Daten um"}</span>
            </button>
          </div>
        ) : (
          <div className="px-4 flex flex-col gap-2 pb-10" data-daten>
            <div className="text-[20px] font-bold">{ios ? "App-Datenschutz" : "Datensicherheit"}</div>
            <p className="text-[13px] text-[#5f6368]">Diese Daten kann »{a.name}« sammeln:</p>
            <ul className="flex flex-col gap-1">
              {a.daten.map(d => <li key={d} className="rounded-lg bg-[#f3f4f6] px-3 py-2 text-[13px]">{d.startsWith("Keine") ? "✅" : "📌"} {d}</li>)}
            </ul>
            <p className="text-[12px] text-[#5f6368]">Je weniger, desto besser.</p>
          </div>
        )}
      </div>
    );
  } else {
    inhalt = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#eff6ff] text-[#111]" style={{ paddingTop: 44 }}>
        <span className="text-5xl">🖌️</span>
        <b>Malblock Kids</b>
        <span className="text-sm text-[#5f6368]">Male drauflos!</span>
        <button type="button" onClick={() => setAnsicht("home")} className="text-sm underline">Zum Startbildschirm</button>
        {angebot && (
          <div className="absolute inset-x-4 top-1/3 rounded-2xl bg-white shadow-2xl p-4 flex flex-col gap-2 text-center" data-angebot>
            <div className="text-[13px] font-black text-[#dc2626]">NUR HEUTE! 🔥</div>
            <div className="text-[15px] font-bold">Super-Pinsel-Paket</div>
            <div className="text-[13px]">50 Glitzerpinsel für nur <b>4,99 €</b></div>
            <button type="button" data-angebot-kaufen onClick={() => angebotWahl(true)} className="rounded-full py-2 font-bold text-white bg-[#16a34a]">Jetzt kaufen</button>
            <button type="button" data-angebot-nein onClick={() => angebotWahl(false)} className="text-[13px] text-[#5f6368]">✕ Nein danke</button>
          </div>
        )}
      </div>
    );
  }

  const telefon = (
    <Handy system={system} bildschirmRef={bildschirm} onHomeLeiste={() => { if (!demo.aktiv) { setAnsicht("home"); setMenue(null); } }}>
      {inhalt}
      {menue && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#00000059]" onClick={() => setMenue(null)}>
          <div className="rounded-2xl bg-white text-[#111] shadow-2xl w-56 overflow-hidden" onClick={e => e.stopPropagation()} data-lang-menue>
            {menue === "menue" ? (
              ios ? (
                <>
                  <button type="button" className="w-full px-4 py-3 text-left text-[14px] border-b border-[#e5e5ea]">Home-Bildschirm bearbeiten</button>
                  <button type="button" data-entfernen onClick={() => setMenue("loeschen")} className="w-full px-4 py-3 text-left text-[14px] text-[#ff3b30]">App entfernen</button>
                </>
              ) : (
                <>
                  <button type="button" className="w-full px-4 py-3 text-left text-[14px] border-b border-[#e5e5ea]">ⓘ App-Info</button>
                  <button type="button" data-entfernen onClick={() => loeschen(true)} className="w-full px-4 py-3 text-left text-[14px]">🗑 Deinstallieren</button>
                </>
              )
            ) : (
              <div className="p-3 flex flex-col gap-2 text-center">
                <b className="text-[14px]">»Taschenlampe Plus« entfernen?</b>
                <button type="button" data-app-loeschen onClick={() => loeschen(true)} className="py-2 text-[14px] text-[#ff3b30] font-bold">App löschen</button>
                <button type="button" data-nur-entfernen onClick={() => loeschen(false)} className="py-2 text-[14px] text-[#007aff]">Vom Home-Bildschirm entfernen</button>
              </div>
            )}
          </div>
        </div>
      )}
      {frage && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#00000059]" data-eltern-frage>
          <div className="rounded-2xl bg-white text-[#111] shadow-2xl w-60 p-4 flex flex-col gap-2 text-center">
            {frage === "wartet" ? (
              <><span className="text-3xl">⏳</span><span className="text-[14px]">Deine Eltern bekommen die Anfrage …</span></>
            ) : (
              <>
                <b className="text-[15px]">{ios ? "Kaufanfrage" : "Genehmigung erforderlich"}</b>
                <span className="text-[13px]">{ios ? "Möchtest du deine Eltern um Erlaubnis bitten, »Malblock Kids« zu laden?" : "Deine Eltern müssen erst zustimmen, bevor du »Malblock Kids« installieren kannst."}</span>
                <button type="button" data-fragen onClick={() => eltern(true)} className="rounded-full py-2 font-bold text-white" style={{ background: akzent }}>{ios ? "Fragen" : "Genehmigung anfordern"}</button>
                <button type="button" onClick={() => eltern(false)} className="text-[13px]" style={{ color: akzent }}>{ios ? "Nicht jetzt" : "Abbrechen"}</button>
              </>
            )}
          </div>
        </div>
      )}
    </Handy>
  );

  const geprueft = gewaehlt && (ansicht === "detail" || ansicht === "daten");

  return (
    <>
      <MobilRahmen
        titel="🛍️ Teil 4 · Apps installieren"
        avatar={avatar}
        fertig={fertig}
        auftrag={fertig ? <>Super — du installierst Apps wie ein Profi und fällst auf Fallen nicht herein!</> : <>{[
          `Öffne den ${store}.`,
          "Such nach einer Mal-App: tippe »malen« ins Suchfeld.",
          "Drei Treffer! Öffne die App, die sicher und für dein Alter gemacht ist.",
          `Schau nach, welche Daten die App sammelt (»${ios ? "App-Datenschutz" : "Datensicherheit"}«).`,
          `Installiere die App. Mit einem Kinderkonto fragt das ${ios ? "iPhone" : "Handy"} zuerst deine Eltern.`,
          "Öffne die neue App auf dem Startbildschirm — und reagier richtig auf das, was dann kommt.",
          "Lösch die alte App »Taschenlampe Plus«, die du nicht mehr brauchst.",
        ][schritt]}</>}
        punkte={punkte()}
        onDemo={vorfuehren}
        onWeiter={onWeiter}
        aufgaben={AUFGABEN}
        schritt={schritt}
        hinweis={hinweis}
        handy={telefon}
        seitenleiste={
          <div className="card p-4 text-sm flex flex-col gap-1">
            <b>🔍 Woran erkennst du eine gute App?</b>
            <span>• Altersfreigabe passt ({ios ? "4+ / 9+" : "USK ab 0 / ab 6"})</span>
            <span>• Bekannter Entwickler, Name richtig geschrieben</span>
            <span>• Viele Bewertungen — nicht nur 5 Sterne von 30 Leuten</span>
            <span>• Fragt nur nach Daten, die sie braucht</span>
            <span>• Keine Werbung, keine In-App-Käufe (oder nur mit Eltern)</span>
            {geprueft && !gewaehlt.urteil.passt && <span className="text-bad font-bold mt-1">→ »{gewaehlt.name}« fällt durch.</span>}
          </div>
        }
      />
      <DemoBuehne demo={demo} />
    </>
  );
}

