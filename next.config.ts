// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/a03",
  output: "standalone",
  // Si servís estáticos detrás de un reverse proxy y ves rutas rotas,
  // podés probar también:
  // assetPrefix: "/a03",
};

export default nextConfig;

// /** @type {import('next').NextConfig} */
// const nextConfig = {
//   experimental: {
//     serverActions: true, // ✅ solo si realmente lo usás
//   },
// };

// module.exports = nextConfig;

