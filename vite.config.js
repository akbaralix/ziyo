import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1", // IPv6 o'rniga IPv4 ishlatish uchun
    port: 3000, // 3000-portga o'tkazish
    strictPort: true, // Boshqa portga o'tib ketmasligi uchun
  },
});
