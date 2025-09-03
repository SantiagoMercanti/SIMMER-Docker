// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;



//Comento esta para no ejecutar typescript y poder testear despliegue
// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   basePath: "/a03",
//   output: "standalone",
//   // Si servís estáticos detrás de un reverse proxy y ves rutas rotas,
//   // podés probar también:
//   // assetPrefix: "/a03",
// };

// export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/a03",
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;


