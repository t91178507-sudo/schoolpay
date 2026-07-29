/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  serverExternalPackages: [
    "tesseract.js",
    "@tesseract.js-data/eng",
    "pdf-parse",
    "@napi-rs/canvas",
  ],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@tesseract.js-data/eng/4.0.0/**"],
  },
};

export default nextConfig;
