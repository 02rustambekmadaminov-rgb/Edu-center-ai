import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: process.env.GITHUB_ACTIONS === "true" ? "/Edu-center-ai/" : "/",
  plugins: [react()],
  server: { host: "0.0.0.0" },
});
