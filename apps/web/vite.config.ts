import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const devApiTarget = process.env.VITE_DEV_API_PROXY ?? "http://127.0.0.1:4000";

export default defineConfig({
  define: {
    "import.meta.env.VITE_CASECROW_AUDIT": JSON.stringify(
      process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "codex/casecrow-visual-audit-20261021" ||
      process.env.VERCEL_ENV !== "production" && process.env.CASECROW_LOCAL_AUDIT === "1" ? "1" : "0",
    ),
  },
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: devApiTarget,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
