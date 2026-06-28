import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // AI : repo root — shared/legal lives outside this app dir; Turbopack blocks parent imports otherwise.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
