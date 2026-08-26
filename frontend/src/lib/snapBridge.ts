/**
 * Zugriff auf den eingebetteten Snap!-Editor (public/snap).
 *
 * Snap! bringt eine eigene Schnittstelle mit (src/api.js, docs/API.md). Da der
 * Editor aus demselben Origin geladen wird, sprechen wir sie direkt über
 * `contentWindow` an — der in der Doku beschriebene postMessage-Weg ist nur für
 * fremde Domains nötig. Snap! selbst bleibt dadurch unverändert; es wird nichts
 * gepatcht, nur ferngesteuert.
 */

/** Nur die Methoden, die diese Seite benutzt. */
export type SnapIde = {
  getProjectXML(): string;
  loadProjectXML(xml: string): void;
  getProjectName(): string;
  setProjectName(name: string): void;
  newProject(): void;
  unsavedChanges(): boolean;
};

type SnapWindow = Window & { world?: { children?: SnapIde[] } };

export const SNAP_URL = "/snap/snap.html";

/** Die IDE, sobald der Editor geladen ist — sonst null. */
export function getIde(frame: HTMLIFrameElement | null): SnapIde | null {
  try {
    const ide = (frame?.contentWindow as SnapWindow | null)?.world?.children?.[0];
    return ide && typeof ide.getProjectXML === "function" ? ide : null;
  } catch {
    // Während des Ladens ist contentWindow kurzzeitig nicht erreichbar.
    return null;
  }
}

/** Wartet, bis Snap! fertig hochgefahren ist (Morphic braucht ein paar Frames). */
export function waitForIde(frame: HTMLIFrameElement | null, timeoutMs = 30_000): Promise<SnapIde> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const ide = getIde(frame);
      if (ide) return resolve(ide);
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("Snap! ist nicht gestartet — fehlt public/snap? (npm run fetch:snap)"));
      }
      window.setTimeout(tick, 100);
    };
    tick();
  });
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'",
};

/** Der Projektname, wie Snap! ihn nach dem Laden melden wird. */
function projectNameOf(xml: string): string {
  const raw = xml.match(/<project[^>]*\sname="([^"]*)"/)?.[1] ?? "";
  return raw.replace(/&(amp|lt|gt|quot|apos);/g, m => ENTITIES[m]);
}

const sleep = (ms: number) => new Promise(r => window.setTimeout(r, ms));

/**
 * Projekt in den Editor laden und anschließend auf den Hauspokal-Titel taufen.
 *
 * `loadProjectXML` arbeitet die Ladeschritte über Animationsframes ab und meldet
 * einen Misserfolg nicht zurück — ein offener Dialog verschluckt sie
 * stillschweigend. Deshalb wird gewartet, bis der Projektname aus dem XML
 * tatsächlich in der IDE steht, statt dem Aufruf zu glauben.
 */
export async function loadProject(ide: SnapIde, xml: string, title: string): Promise<void> {
  const erwartet = projectNameOf(xml);
  ide.setProjectName("");
  ide.loadProjectXML(xml);

  if (!erwartet) {
    // Namenloses Projekt: nichts, worauf sich warten ließe.
    await sleep(1500);
    ide.setProjectName(title);
    return;
  }
  for (let i = 0; i < 60; i++) {
    await sleep(100);
    if (ide.getProjectName() === erwartet) {
      ide.setProjectName(title);
      return;
    }
  }
  throw new Error("Projekt konnte nicht geladen werden");
}
