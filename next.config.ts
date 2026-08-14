import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // The in-app browser sometimes uses 127.0.0.1 while the dev server binds localhost.
  // Allow that equivalent local origin for dev-only assets and RSC requests.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
