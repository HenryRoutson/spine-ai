import type { NextConfig } from "next";
import { config as loadEnv } from "dotenv";
import path from "path";

const dashboardRoot = __dirname;
const repoRoot = path.join(dashboardRoot, "..");

// AI : edge middleware can't call dotenv — load repo root .env before Next reads process.env.
loadEnv({ path: path.join(dashboardRoot, ".env.local") });
loadEnv({ path: path.join(repoRoot, ".env") });

const nextConfig: NextConfig = {
  // AI : repo root .env is shared with combined_full_stack — allow parent reads under Turbopack.
  turbopack: {
    root: repoRoot,
  },
};

export default nextConfig;
