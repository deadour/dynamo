import { defineConfig, type Plugin } from 'vite'; import react from '@vitejs/plugin-react';
import { copyFileSync, mkdirSync } from 'node:fs'; import { join } from 'node:path';

// Rutas de la app. El hosting estático no conoce las rutas de React: sin un archivo real en cada una,
// recargar la página da "Not Found". Se copia index.html en cada ruta (y como 404.html de respaldo).
// Las pantallas con ID usan ?id=..., así la ruta sigue siendo fija y recargan igual.
export const APP_ROUTES = ["ingresar", "inicio", "ejercicios", "ejercicio", "entrenar", "entrenamientos", "entrenamiento", "peso", "perfil", "rutinas", "rutina", "rutina-compartida", "admin", "admin/usuario"];

function spaRoutes(): Plugin {
  let outDir = "dist";
  return {
    name: "spa-routes",
    apply: "build",
    configResolved(config) { outDir = config.build.outDir; },
    closeBundle() {
      const index = join(outDir, "index.html");
      for (const route of APP_ROUTES) { mkdirSync(join(outDir, route), { recursive: true }); copyFileSync(index, join(outDir, route, "index.html")); }
      copyFileSync(index, join(outDir, "404.html"));
    },
  };
}

export default defineConfig({plugins:[react(), spaRoutes()],server:{port:5173},test:{environment:"jsdom",setupFiles:"./src/test-setup.ts"}});
