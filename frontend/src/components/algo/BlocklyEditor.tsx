"use client";
/**
 * Blockly-Editor (Ziehen & Andocken, Look wie Scratch über den »zelos«-Renderer).
 *
 * Blockly wird erst im Browser nachgeladen. Der Arbeitsbereich wird nur beim
 * Einhängen aus `prog` aufgebaut — Änderungen gehen per `onChange` hinaus,
 * fließen aber nicht zurück (sonst spränge jeder Zug). Wer ein anderes Programm
 * laden will, hängt den Editor mit neuem `key` neu ein.
 */
import { useEffect, useRef, useState } from "react";
import type { WorkspaceSvg } from "blockly/core";
import { PFEIL, type BedingungArt, type BefehlTyp, type Programm } from "@/lib/algo/spiel";
import { ausJson, zuJson } from "@/lib/algo/blocklyJson";
import { BEDINGUNG_TEXT } from "@/lib/algo/kacheln";
import { BAUSTEIN } from "./KachelEditor";

type BlocklyModul = typeof import("blockly/core");

function farbe(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function definiere(B: BlocklyModul, verb: string, bedingungen: BedingungArt[]) {
  const optionen = bedingungen.flatMap(a => [[BEDINGUNG_TEXT[a][0], a], [BEDINGUNG_TEXT[a][1], `nicht:${a}`]]);
  const bed = optionen.length ? optionen : [["vorne frei", "frei"]];
  const befehl = (type: string, text: string, t: BefehlTyp) => ({
    type, message0: text, previousStatement: null, nextStatement: null, colour: BAUSTEIN[t].farbe,
  });
  B.common.defineBlocksWithJsonArray([
    { type: "algo_start", message0: "▶ wenn Start geklickt", nextStatement: null, colour: "#f59e0b", hat: "cap" },
    { type: "algo_fn", message0: "📦 Unterprogramm", nextStatement: null, colour: BAUSTEIN.rufe.farbe, hat: "cap" },
    {
      type: "algo_geh", message0: "geh %1", previousStatement: null, nextStatement: null, colour: BAUSTEIN.geh.farbe,
      args0: [{ type: "field_dropdown", name: "R", options: PFEIL.map((p, i) => [p, String(i)]) }],
    },
    befehl("algo_vor", BAUSTEIN.vor.text(verb), "vor"),
    befehl("algo_links", BAUSTEIN.links.text(verb), "links"),
    befehl("algo_rechts", BAUSTEIN.rechts.text(verb), "rechts"),
    befehl("algo_nimm", BAUSTEIN.nimm.text(verb), "nimm"),
    befehl("algo_warte", BAUSTEIN.warte.text(verb), "warte"),
    befehl("algo_rufe", "📦 rufe Unterprogramm auf", "rufe"),
    {
      type: "algo_wiederhole", message0: "🔁 wiederhole %1 mal", message1: "%1",
      args0: [{ type: "field_number", name: "N", value: 3, min: 1, max: 99, precision: 1 }],
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null, nextStatement: null, colour: BAUSTEIN.wiederhole.farbe,
    },
    {
      type: "algo_bis", message0: "🔁 wiederhole bis %1", message1: "%1",
      args0: [{ type: "field_dropdown", name: "B", options: bed }],
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null, nextStatement: null, colour: BAUSTEIN.bis.farbe,
    },
    {
      type: "algo_wenn", message0: "❓ wenn %1", message1: "%1",
      args0: [{ type: "field_dropdown", name: "B", options: bed }],
      args1: [{ type: "input_statement", name: "DO" }],
      previousStatement: null, nextStatement: null, colour: BAUSTEIN.wenn.farbe,
    },
    {
      type: "algo_wenn_sonst", message0: "❓ wenn %1", message1: "%1", message2: "sonst", message3: "%1",
      args0: [{ type: "field_dropdown", name: "B", options: bed }],
      args1: [{ type: "input_statement", name: "DO" }],
      args3: [{ type: "input_statement", name: "SONST" }],
      previousStatement: null, nextStatement: null, colour: BAUSTEIN.wenn.farbe,
    },
  ]);
}

function werkzeugkasten(erlaubt: BefehlTyp[]) {
  const inhalt: { kind: string; type: string; fields?: Record<string, string> }[] = [];
  for (const t of erlaubt) {
    if (t === "geh") for (let r = 0; r < 4; r++) inhalt.push({ kind: "block", type: "algo_geh", fields: { R: String(r) } });
    else if (t === "wenn") inhalt.push({ kind: "block", type: "algo_wenn" }, { kind: "block", type: "algo_wenn_sonst" });
    else inhalt.push({ kind: "block", type: `algo_${t}` });
  }
  return { kind: "flyoutToolbox", contents: inhalt };
}

export default function BlocklyEditor({
  prog, onChange, erlaubt, bedingungen = [], verb, aktiv, nurLesen = false,
}: {
  prog: Programm;
  onChange: (p: Programm) => void;
  erlaubt: BefehlTyp[];
  bedingungen?: BedingungArt[];
  verb: string;
  aktiv?: string;
  nurLesen?: boolean;
}) {
  const ort = useRef<HTMLDivElement>(null);
  const ws = useRef<WorkspaceSvg | null>(null);
  const melden = useRef(onChange);
  melden.current = onChange;
  const startProg = useRef(prog);
  const [fehler, setFehler] = useState<string | null>(null);
  const mitFn = erlaubt.includes("rufe");
  const schluessel = `${erlaubt.join()}|${bedingungen.join()}|${verb}|${nurLesen}`;

  useEffect(() => {
    let aus = false;
    (async () => {
      try {
        const B = await import("blockly/core");
        const De = await import("blockly/msg/de");
        if (aus || !ort.current) return;
        B.setLocale(De as unknown as Record<string, string>);
        definiere(B, verb, bedingungen);
        const thema = B.Theme.defineTheme("algo", {
          name: "algo",
          base: B.Themes.Classic,
          componentStyles: {
            workspaceBackgroundColour: farbe("--surface") || "#ffffff",
            flyoutBackgroundColour: farbe("--bg") || "#f1f5f9",
            flyoutOpacity: 1,
            scrollbarColour: farbe("--border") || "#94a3b8",
          },
          fontStyle: { family: "inherit", weight: "bold", size: 13 },
        });
        const w = B.inject(ort.current, {
          toolbox: nurLesen ? undefined : werkzeugkasten(erlaubt),
          readOnly: nurLesen,
          renderer: "zelos",
          theme: thema,
          trashcan: !nurLesen,
          move: { scrollbars: true, drag: true, wheel: false },
          zoom: { controls: true, wheel: true, startScale: 0.9 },
          sounds: false,
        });
        ws.current = w;
        B.serialization.workspaces.load(zuJson(startProg.current, mitFn), w);
        for (const b of w.getTopBlocks(false)) {
          if (b.type === "algo_start" || b.type === "algo_fn") b.setDeletable(false);
        }
        w.addChangeListener(e => {
          if (e.isUiEvent || w.isDragging()) return;
          melden.current(ausJson(B.serialization.workspaces.save(w)));
        });
      } catch (e) {
        setFehler(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      aus = true;
      ws.current?.dispose();
      ws.current = null;
    };
    // Neu aufbauen nur, wenn sich Palette oder Wörter ändern — nicht bei jedem Programmzug.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, mitFn]);

  useEffect(() => {
    ws.current?.highlightBlock(aktiv ?? null);
  }, [aktiv]);

  if (fehler) return <div className="card p-3 text-sm text-bad">Blockly konnte nicht geladen werden: {fehler}</div>;
  return <div ref={ort} className="w-full rounded-xl overflow-hidden border border-line" style={{ height: nurLesen ? 260 : 440 }} data-testid="blockly-editor" />;
}
