/**
 * Wer hängt woran.
 *
 * Mehrere Rechenwerke brauchen dieselbe Frage beantwortet: *was hängt unter
 * diesem Anschluss?* Der Kraftmesser, um die Last zu wiegen; das Federpendel,
 * um zu wissen, wie schwer es inzwischen geworden ist; später der Flaschenzug,
 * um die Kraft durch die Rollen zu führen.
 *
 * Gefolgt wird nur Verbindungen der angegebenen Art — ein Kabel trägt keine
 * Last, eine Schnur leitet keinen Strom. Der Satz »gesehen« hält Ringe auf und
 * verhindert, dass der Lauf über den Ausgangspunkt wieder zurückführt.
 */
import { portVon } from "./katalog";
import type { Geraet, PortArt, Szene } from "./typen";

/**
 * Alle Geräte, die — unmittelbar oder über andere — an diesem Anschluss
 * hängen. Das Ausgangsgerät selbst ist nicht dabei.
 */
export function haengtDaran(
  szene: Szene,
  geraetId: string,
  port: string,
  art: PortArt = "mechanik",
): Geraet[] {
  const typVon = (id: string) => szene.geraete.find(g => g.id === id)?.typ;

  const nachbarn = (von: string, nurPort?: string): string[] => {
    const ziele: string[] = [];
    for (const v of szene.verbindungen) {
      const enden = [[v.von, v.nach], [v.nach, v.von]] as const;
      for (const [hier, dort] of enden) {
        if (hier.geraet !== von) continue;
        if (nurPort !== undefined && hier.port !== nurPort) continue;
        const typ = typVon(hier.geraet);
        if (!typ || portVon(typ, hier.port)?.art !== art) continue;
        ziele.push(dort.geraet);
      }
    }
    return ziele;
  };

  const gesehen = new Set<string>([geraetId]);
  const offen = nachbarn(geraetId, port);
  const gefunden: Geraet[] = [];

  while (offen.length) {
    const id = offen.pop();
    if (id === undefined || gesehen.has(id)) continue;
    gesehen.add(id);
    const g = szene.geraete.find(x => x.id === id);
    if (!g) continue;
    gefunden.push(g);
    offen.push(...nachbarn(id));
  }

  return gefunden;
}
