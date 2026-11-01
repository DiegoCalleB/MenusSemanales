import type { NextConfig } from "next";
import { cabecerasSeguridad } from "./src/infraestructura/seguridad/cabeceras";

const nextConfig: NextConfig = {
  // Servidor autónomo mínimo para la imagen Docker de Railway.
  output: "standalone",
  // No anunciar la tecnología del servidor.
  poweredByHeader: false,
  // `cacheComponents` (prerenderizado parcial) es incompatible con la CSP con nonce: se prioriza
  // la seguridad. Es una app privada con datos por usuario, así que todo es dinámico igualmente.
  // Ver docs/decisiones.md (D-025).
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: [...cabecerasSeguridad] }];
  },
};

export default nextConfig;
