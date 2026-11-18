/**
 * Compile GLSL shaders with glslangValidator at container start.
 * Extracts VERT and FRAG from fluessigkeit/shader.ts and fails fast if either
 * shader has a compile error, printing line-numbered source + driver log.
 */
import { readFileSync, writeFileSync, unlinkSync } from "fs";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { join } from "path";

const SRC_FILE = "src/components/fluessigkeit/shader.ts";
const src = readFileSync(SRC_FILE, "utf8");

function extract(name) {
  // Match:  export const NAME = `...`
  const m = src.match(new RegExp(`export const ${name} = \`([\\s\\S]*?)\``));
  if (!m) throw new Error(`Could not find exported const ${name} in ${SRC_FILE}`);
  return m[1];
}

// glslangValidator requires #version to enter GLSL ES 1.00 mode.
// WebGL omits it (defaults to 100), so we prepend it for the validator.
const shaders = [
  { name: "VERT", src: "#version 100\n" + extract("VERT"), ext: "vert" },
  { name: "FRAG", src: "#version 100\n" + extract("FRAG"), ext: "frag" },
];

let ok = true;
const tmpFiles = [];

for (const { name, src: glsl, ext } of shaders) {
  const path = join(tmpdir(), `hauspokal_${name}.${ext}`);
  tmpFiles.push(path);
  writeFileSync(path, glsl);

  try {
    execSync(`glslangValidator ${path}`, { stdio: "pipe" });
    console.log(`  ✓ ${name} shader OK`);
  } catch (err) {
    ok = false;
    const log = err.stdout?.toString() || err.stderr?.toString() || "(no output)";
    console.error(`\n  ✗ ${name} shader FAILED:\n${log}`);
    console.error(`  Source (${name}):`);
    glsl.split("\n").forEach((line, i) =>
      console.error(`    ${String(i + 1).padStart(3)}: ${line}`)
    );
  }
}

for (const f of tmpFiles) {
  try { unlinkSync(f); } catch (_) { /* ignore */ }
}

if (!ok) {
  console.error("\nShader compilation failed — fix GLSL errors before starting.\n");
  process.exit(1);
}

console.log("Shaders compiled OK.\n");
