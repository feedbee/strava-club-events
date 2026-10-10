import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  base: "/next/",
  publicDir: false,
  build: { outDir: "../public/next", emptyOutDir: true },
  server: {
    host: "127.0.0.1",
    proxy: Object.fromEntries(
      [
        "/me",
        "/events",
        "/login",
        "/logout",
        "/favicon.png",
        "/images",
        "/about.html",
        "/prototypes",
      ].map((path) => [path, "http://127.0.0.1:3000"]),
    ),
  },
});
