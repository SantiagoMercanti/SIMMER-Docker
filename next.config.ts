import type { NextConfig } from "next";

// Leé el base path desde el entorno:
// - DEV en Docker: BASE_PATH no seteado (o vacío) => sin subpath
// - PROD: BASE_PATH="/a03"
const basePath = (process.env.BASE_PATH || "").trim();

const nextConfig: NextConfig = {
  basePath: basePath || undefined,
  assetPrefix: basePath ? `${basePath}/` : undefined,
  output: "standalone",

//  typescript: { ignoreBuildErrors: process.env.SKIP_TYPECHECK === "1" },
//  eslint:     { ignoreDuringBuilds: process.env.SKIP_LINT === "1" },
};

export default nextConfig;
