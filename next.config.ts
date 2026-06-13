import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-extra", "puppeteer-extra-plugin-stealth", "puppeteer-core", "puppeteer"],
  // Force Turbopack to use this directory as the root, avoiding picking up lockfiles higher in the file tree
  // which causes it to miss the .env.local file.
  turbopack: {
    // process.cwd() will be the project directory when running 'npm run dev'
    root: process.cwd(),
  },
};

export default nextConfig;
