import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { FernsehenDemo } from "@/components/medien/demos/Fernsehen";
import { CdDemo, zuBits, alsSpur, ausSpur, alsText } from "@/components/medien/demos/CD";
import { VideotextDemo, seite } from "@/components/medien/demos/Videotext";

describe("Medien-Demos B", () => {
  it("rendert ohne Absturz", () => {
    render(<FernsehenDemo />);
    render(<CdDemo />);
    render(<VideotextDemo />);
  });
  it("CD-Spur: Hin und zurück", () => {
    const bits = zuBits("HALLO");
    expect(bits).toHaveLength(40);
    expect(ausSpur(alsSpur(bits))).toEqual(bits);
    expect(alsText(ausSpur(alsSpur(bits)))).toBe("HALLO");
  });
  it("Videotext-Seiten", () => {
    expect(seite(100)).toBeDefined();
    expect(seite(777)?.unter).toHaveLength(2);
    expect(seite(999)).toBeUndefined();
  });
});
