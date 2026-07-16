import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@milkdown/crepe", "@milkdown/react", "@milkdown/kit", "@milkdown/prose"],
};

export default nextConfig;
