import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
  return [
    { source: '/treinamento-de-interface', destination: '/treinamentos/interface.html' },
    { source: '/treinamento-de-topologia', destination: '/treinamentos/topologia.html' },
  ]
}
};
 
export default nextConfig;
