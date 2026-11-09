import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 生成 .next/standalone，供 Dockerfile 构建精简运行镜像
  output: "standalone",
};

export default nextConfig;
