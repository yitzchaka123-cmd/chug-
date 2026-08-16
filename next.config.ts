import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PDF generation (signed agreements, schedules, lyrics) reads the logo and
  // fonts from public/ at runtime; include them in the traced serverless
  // bundles so they exist under /var/task on Vercel.
  outputFileTracingIncludes: {
    "/api/**": [
      "./public/choir-chug-logo-transparent.png",
      "./public/fonts/**",
    ],
  },
};

export default nextConfig;
