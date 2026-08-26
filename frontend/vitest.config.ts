import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    globals: true,
    // 21 jsdom-Dateien laufen parallel; unter Last brauchen die schwereren
    // userEvent-Tests (Play, Lückentext) mehr als die 5 s Voreinstellung und
    // fielen dann sprunghaft mal hier, mal dort aus. Einzeln laufen dieselben
    // Tests in unter 2 s — der Wert federt die Last ab, er verdeckt nichts.
    testTimeout: 15_000,
  },
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
});
