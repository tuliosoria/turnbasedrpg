/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  // `import.meta.env.PROD` no cliente só estoura quando o bundle abre. Aqui o
  // `vite build` (mode production) para antes de emitir o mock.
  if (command === "build" && mode === "production") {
    const url = loadEnv(mode, process.cwd(), "VITE_").VITE_API_BASE_URL?.trim() ?? "";
    if (!url) {
      throw new Error(
        "VITE_API_BASE_URL está vazio num build de produção. Copie frontend/.env.production antes de buildar — sem isso o bundle usaria o MockApiClient.",
      );
    }
  }

  return {
    plugins: [react()],
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./src/test/setup.ts",
      css: false,
      // O default de 5s é apertado para os testes que montam a página inteira.
      //
      // Quatro deles já carregavam um teto explícito de 20s por esse motivo;
      // isto generaliza a mesma decisão em vez de espalhá-la teste a teste. Não
      // esconde travamento: um teste que trava continua reprovando, só que por
      // ter travado e não por a máquina estar ocupada.
      testTimeout: 30000,
    },
  };
});
