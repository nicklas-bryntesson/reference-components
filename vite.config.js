import { defineConfig } from "vite";
import { resolve } from "path";
import handlebars from "vite-plugin-handlebars";
import postcssNesting from "postcss-nesting";
import autoprefixer from "autoprefixer";

const POC_ASSETS_BASE = "https://nicklas-bryntesson.github.io/poc-assets/";

export default defineConfig({
  // A fixed port, and `strictPort` so a clash FAILS instead of gliding to the next
  // free one. The silent glide is the bug: a consuming project on Vite's default
  // 5173 keeps that port, this server moves to 5174, and you open 5173 and get the
  // wrong UI with no error anywhere. Loud beats convenient.
  server: {
    port: 5175,
    strictPort: true,
  },

  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        autofill: resolve(__dirname, "autofill.html"),
      },
    },
  },
  css: {
    postcss: {
      plugins: [postcssNesting(), autoprefixer()],
    },
  },
  plugins: [
    handlebars({
      partialDirectory: resolve(__dirname, "src/partials"),
      helpers: {
        default: (value, defaultValue) => (value !== undefined ? value : defaultValue),
        poc: (path) => POC_ASSETS_BASE + (path || "").replace(/^\//, ""),
      },
    }),
  ],
});
