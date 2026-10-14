/** Ob die Person reduzierte Bewegung wünscht (prefers-reduced-motion); ohne Browser oder matchMedia: nein. */
export const wenigerBewegung = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function" && !!window.matchMedia("(prefers-reduced-motion: reduce)")?.matches;
