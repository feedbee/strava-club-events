import { defineConfig } from "vite";

export default defineConfig({
  root: "frontend",
  base: "/",
  publicDir: false,
  build: { outDir: "../public/app", emptyOutDir: true },
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
        "/limits.html",
        "/prototypes",
      ].map((path) => [path, "http://127.0.0.1:3000"]),
    ),
  },
});
