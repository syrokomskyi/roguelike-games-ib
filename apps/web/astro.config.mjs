import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  build: {
    format: "directory",
  },
  vite: {
    plugins: [tailwindcss()],
    ssr: {
      noExternal: ["@roguelike-games-ib/projection-sdk", "@roguelike-games-ib/search", "@roguelike-games-ib/materializer", "@roguelike-games-ib/knowledge-core"],
    },
  },
});
