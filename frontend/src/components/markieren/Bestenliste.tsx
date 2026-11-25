"use client";
/**
 * Bestenliste der Challenge — die schnellsten hundert je Modus, auch Gäste.
 * Dünne Hülle um die gemeinsame Bestenliste; die kleinste Zeit gewinnt.
 */
import { useQuery } from "@tanstack/react-query";
import { api, type MausZugang } from "@/lib/api";
import { MODI } from "@/lib/markieren/aufgaben";
import GemeinsameBestenliste from "@/components/Bestenliste";
import { sek } from "./Challenge";

const LISTE = (Object.keys(MODI) as (keyof typeof MODI)[]).map(m => ({ id: m, titel: MODI[m].titel, icon: MODI[m].icon }));

export default function Bestenliste({ zugang, verwaltung, klasse, sitzungCode: gewaehlt }: {
  zugang?: MausZugang;
  /** Lehrkraft auf der Werkzeugseite: »Diese Sitzung« = ihre eigene. */
  verwaltung?: boolean;
  klasse?: string | null;
  /** Lehrkraft: die gewählte Sitzung (je Klasse eine). */
  sitzungCode?: string | null;
}) {
  // Hier und nicht in der Hülle: die Offline-Datei hat keinen QueryClient.
  const { data: eigeneSitzung } = useQuery({
    queryKey: ["markieren-sitzung"],
    queryFn: () => api.toolSessions.create("markieren"),
    enabled: !!verwaltung && !zugang && !gewaehlt,
  });
  return (
    <GemeinsameBestenliste
      werkzeug="markieren" modi={LISTE} zugang={zugang} klasse={klasse}
      sitzungCode={zugang?.code ?? gewaehlt ?? eigeneSitzung?.code ?? null}
      format={wert => sek(wert)}
      detail={e => `${e.extra.aktionen ?? 0} Aktionen`}
      leer="Noch kein Eintrag. Wer eine Challenge ohne Überspringen schafft, steht hier."
      fuss="Je Person zählt nur die schnellste Runde ohne Überspringen. Gäste über den QR-Code stehen mit ihrem eingegebenen Namen in der Liste."
    />
  );
}
