/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    css: false,
    exclude: ["node_modules", "dist", "tests/e2e/**"],
    // O default de 5s é apertado para os testes que montam a página inteira.
    //
    // Quatro deles já carregavam um teto explícito de 20s por esse motivo;
    // isto generaliza a mesma decisão em vez de espalhá-la teste a teste. Não
    // esconde travamento: um teste que trava continua reprovando, só que por
    // ter travado e não por a máquina estar ocupada.
    testTimeout: 30000,
  },
});
