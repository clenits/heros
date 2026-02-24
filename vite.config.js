import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: "node_modules/js-dos/dist/*",
          dest: "static/js-dos",
        },
        {
          src: "heros.zip",
          dest: "static/game",
        },
        {
          src: "Sam4PK.zip",
          dest: "static/game",
        },
      ],
    }),
  ],
});
