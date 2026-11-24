import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.16.0.2", "192.168.0.107", "192.168.172.174"],
  transpilePackages: ["@milkdown/crepe", "@milkdown/react", "@milkdown/kit", "@milkdown/prose"],
};

export default nextConfig;
