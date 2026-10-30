import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { KOMMENTARE, SPRUECHE } from "@/lib/klikk/klasse";
import { MEHR } from "@/lib/klikk/mehrPosts";

// Feste Kommentare und Sprüche stehen doppelt: hier und im Backend (api/routers/klikk.py)
const backend = readFileSync(join(__dirname, "../../../api/routers/klikk.py"), "utf-8");

describe("Klikk: feste Listen", () => {
  it("jeder Kommentar und Spruch steht gleich im Backend", () => {
    for (const [id, k] of Object.entries(KOMMENTARE)) expect(backend, id).toContain(`"${id}": "${k.text}"`);
    for (const [id, text] of Object.entries(SPRUECHE)) expect(backend, id).toContain(`"${id}": "${text}"`);
  });
  it("Meme-Beiträge haben ein Bild-Emoji und Top-Kommentare", () => {
    const memes = MEHR.filter(p => p.id.startsWith("me"));
    expect(memes.length).toBeGreaterThanOrEqual(9);
    for (const p of memes) {
      expect(p.emoji).not.toBe("");
      expect(p.kommentare?.length).toBeGreaterThan(1);
    }
  });
});
