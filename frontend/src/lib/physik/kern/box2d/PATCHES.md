# Änderungen an Phaser Box2D 1.1.0

Quelle: npm `phaser-box2d@1.1.0`, `dist/PhaserBox2D.js`
(sha256 des Originals `167d50ae1e67cbeaa47e2e152a4721005cb136d7ccd9e1e9c82a603235c79c10`), MIT.

Eingebunden statt als Abhängigkeit, weil das Paket keine Typen mitbringt,
eslint als Laufzeitabhängigkeit führt, auf eine nicht vorhandene `index.js`
verweist und seit Januar 2025 nicht mehr veröffentlicht wurde.

Jede Änderung ist im Code mit `HAUSPOKAL-PATCH` markiert.

1. **`b2DestroyWorld` gibt den Platz frei.** Der Port setzte nur eine lokale
   Variable zurück; der Weltplatz blieb belegt, und nach 32 Versuchen schlug
   `b2CreateWorld` still fehl (es liefert dann die ungültige Id 0). Geprüft in
   `physik.kern.test.ts` (»gibt beim Zerstören den Platz frei«).
