import type { NextConfig } from "next";

// En dev (local sin proxy) podés dejar BASE_PATH vacío.
// En prod (detrás de Nginx) usamos "/a03".
const basePath = (process.env.BASE_PATH || "").trim();

const nextConfig: NextConfig = {
  // Si basePath es "", pasamos undefined para que Next no lo aplique en dev.
  basePath: basePath || undefined,
    experimental: {
    instrumentationHook: true,
  },
  // Hacer que los assets apunten a /a03/_next/...
  // Solo lo seteamos cuando hay basePath.
  assetPrefix: basePath ? `${basePath}/` : undefined,

  output: "standalone",

};

export default nextConfig;
