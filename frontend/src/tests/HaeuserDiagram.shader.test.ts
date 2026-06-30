import { describe, it, expect } from "vitest";
import { VERT, FRAG } from "@/components/HaeuserDiagram";

// GLSL ES 1.00 rules that cause silent "Shader error: null" on strict drivers.
// These tests catch the exact classes of bugs seen in production.

const shaders = [
  { name: "VERT", src: VERT },
  { name: "FRAG", src: FRAG },
];

describe("GLSL shaders", () => {
  for (const { name, src } of shaders) {
    describe(name, () => {
      it("contains only ASCII characters", () => {
        const bad = [...src].filter((c) => c.charCodeAt(0) > 127);
        expect(bad, `Non-ASCII chars found: ${[...new Set(bad)].join(" ")}`).toHaveLength(0);
      });

      it("has no uninitialized variable declarations", () => {
        // GLSL ES 1.00: `float x;` without `= …` is technically allowed by the
        // spec, but many mobile/embedded drivers reject it with a null info log.
        // Rule: every local variable declaration must carry an initialiser.
        // Matches: `float foo;`  `vec3 N;`  `bool b;`  but NOT `float x = 0.0;`
        // (lines with `=` before `;` are fine — they are initialized)
        const uninit =
          /^\s*(float|int|bool|vec[234]|mat[234])\s+\w+\s*;/gm;
        const hits = [...src.matchAll(uninit)]
          .filter((m) => !m[0].includes("="))
          .map((m) => m[0].trim());
        expect(
          hits,
          `Uninitialized declarations:\n${hits.join("\n")}`
        ).toHaveLength(0);
      });

      it("does not use mix(vec, vec, vec) — only mix(vec, vec, float) is guaranteed in ES 1.00", () => {
        // mix(genType, genType, genType) exists in spec but some drivers reject it.
        // Expand manually: px = a + (b - a) * t  instead of mix(a, b, vec_t).
        const mixCalls = [...src.matchAll(/\bmix\s*\(/g)];
        for (const m of mixCalls) {
          // Extract the third argument by counting parens from the opening (
          const after = src.slice(m.index! + m[0].length - 1); // from '('
          let depth = 0, i = 0, args = 0;
          let arg3Start = -1;
          for (; i < after.length; i++) {
            if (after[i] === "(") depth++;
            else if (after[i] === ")") { depth--; if (depth === 0) break; }
            else if (after[i] === "," && depth === 1) {
              args++;
              if (args === 2) arg3Start = i + 1;
            }
          }
          if (arg3Start < 0) continue;
          const arg3 = after.slice(arg3Start, i).trim();
          // If arg3 looks like a vec (contains a dot, vec keyword, or uniform)
          // and is NOT a plain float literal or uniform float, flag it.
          const isVec = /\bvec[234]\b|\bv_px\b|\bu_\w+\.(x|y|z|w)\b/.test(arg3);
          expect(
            isVec,
            `mix() with vector third arg found: mix(…, …, ${arg3})`
          ).toBe(false);
        }
      });

      it("has no if-statements inside for-loops (use step() instead)", () => {
        // Dynamic branching inside loops fails silently on many embedded WebGL drivers.
        // Use step()/clamp() gates instead of if() to keep control flow uniform.
        const loopBody = /for\s*\([^)]+\)\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g;
        for (const m of src.matchAll(loopBody)) {
          const body = m[1];
          const hasIf = /\bif\s*\(/.test(body);
          expect(hasIf, `if() found inside for-loop body:\n${body.trim()}`).toBe(false);
        }
      });

      it("does not call pow() with a base that can be negative", () => {
        // pow(x, y) is undefined in GLSL ES 1.00 when x < 0.
        // Safe pattern: pow(max(0.0, ...), y)  or  x*x  instead.
        // Flag any pow( call whose first arg is not wrapped in max(0
        const powCalls = [...src.matchAll(/\bpow\s*\(/g)];
        for (const m of powCalls) {
          const after = src.slice(m.index!);
          // Allow pow(max(0 or pow(abs( — anything else is suspicious
          const safePrefix = /^\bpow\s*\(\s*(max\s*\(\s*0|abs\s*\()/;
          expect(
            safePrefix.test(after),
            `Unsafe pow() at: ${after.slice(0, 60).trim()}`
          ).toBe(true);
        }
      });
    });
  }
});
