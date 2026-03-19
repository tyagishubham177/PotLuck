import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@potluck/config", "@potluck/contracts", "@potluck/ui"]
};

export default nextConfig;
