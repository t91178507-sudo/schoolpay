/** @type {import("next").NextConfig} */
const nextConfig = {
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
