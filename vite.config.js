import { defineConfig } from "vite";
import { resolve } from "path";
import handlebars from "vite-plugin-handlebars";
import postcssNesting from "postcss-nesting";
import autoprefixer from "autoprefixer";

const POC_ASSETS_BASE = "https://nicklas-bryntesson.github.io/poc-assets/";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
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
