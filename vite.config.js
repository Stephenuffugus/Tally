import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" makes every asset path relative, so the built folder runs from any
// sub-path — a GitHub Pages project site (/Tally/) or lucidwinds.com/satellites/tally/.
export default defineConfig({
  base: "./",
  plugins: [react()],
});
