import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
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
      ],
    }),
  ],
});
