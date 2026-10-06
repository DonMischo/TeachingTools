import { describe, expect, it } from "vitest";
import { verschiebeNach } from "@/lib/algo/kacheln";
import type { Programm } from "@/lib/algo/spiel";

const p: Programm = {
  haupt: [
    { t: "vor", id: "a" },
    { t: "wiederhole", n: 2, id: "w", k: [{ t: "links", id: "l" }] },
    { t: "nimm", id: "n" },
  ],
  fn: [],
};
const ids = (q: Programm) => JSON.stringify(q.haupt, (k, v) => (k === "t" || k === "n" ? undefined : v));

describe("verschiebeNach", () => {
  it("verschiebt innerhalb einer Liste nach hinten", () => {
    const q = verschiebeNach(p, { liste: "haupt", index: 0 }, { liste: "haupt", index: 3 });
    expect(q.haupt.map(b => b.id)).toEqual(["w", "n", "a"]);
  });
  it("zieht in eine Schleife hinein, auch wenn davor etwas fehlt", () => {
    const q = verschiebeNach(p, { liste: "haupt", index: 0 }, { liste: "haupt.1.k", index: 1 });
    expect(q.haupt.map(b => b.id)).toEqual(["w", "n"]);
    expect((q.haupt[0] as { k: { id?: string }[] }).k.map(b => b.id)).toEqual(["l", "a"]);
  });
  it("zieht aus einer Schleife heraus", () => {
    const q = verschiebeNach(p, { liste: "haupt.1.k", index: 0 }, { liste: "haupt", index: 0 });
    expect(q.haupt.map(b => b.id)).toEqual(["l", "a", "w", "n"]);
    expect(ids(q)).toContain('"k":[]');
  });
  it("verweigert, einen Behälter in sich selbst zu ziehen", () => {
    expect(verschiebeNach(p, { liste: "haupt", index: 1 }, { liste: "haupt.1.k", index: 0 })).toBe(p);
  });
});
