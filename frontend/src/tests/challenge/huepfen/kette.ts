import { HOEHE, MAX_ANSTIEG, MAX_LUECKE, type Level } from "@/lib/challenge/huepfen";

/** Prüft nur die Geometrie der Kette (Lücke, Anstieg); die Physik-Probe steht in den Tests. */
export function kettePasst(l: Level): boolean {
  return l.plattformen.every((p, i) => {
    if (i === 0) return true;
    const v = l.plattformen[i - 1];
    return p.x - (v.x + v.w) <= MAX_LUECKE && v.y - p.y <= MAX_ANSTIEG && p.y >= 3 && p.y < HOEHE;
  });
}
