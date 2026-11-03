import { describe, it, expect } from "vitest";
import { heiltrank } from "@/lib/challenge/heiltrank";

describe("heiltrank", () => {
  it("heilt bei Teiltreffer ein wenig, bei Daneben viel, bei Treffer gar nicht", () => {
    expect(heiltrank({ treffer: true, komplett: true }, 100, 50)).toBe(0);
    expect(heiltrank({ treffer: true, komplett: false }, 100, 50)).toBe(10);
    expect(heiltrank({ treffer: false, komplett: false }, 100, 50)).toBe(30);
  });
  it("nie über die vollen Lebenspunkte hinaus", () => {
    expect(heiltrank({ treffer: false, komplett: false }, 100, 12)).toBe(12);
    expect(heiltrank({ treffer: false, komplett: false }, 100, 0)).toBe(0);
  });
});
