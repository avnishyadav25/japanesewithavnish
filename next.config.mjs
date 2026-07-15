/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/jlpt/n5", destination: "/jlpt?level=n5", permanent: true },
      { source: "/jlpt/n4", destination: "/jlpt?level=n4", permanent: true },
      { source: "/jlpt/n3", destination: "/jlpt?level=n3", permanent: true },
      { source: "/jlpt/n2", destination: "/jlpt?level=n2", permanent: true },
      { source: "/jlpt/n1", destination: "/jlpt?level=n1", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "cdn.shopify.com", pathname: "/**" },
      // R2 public bucket URLs (add your custom domain here if needed)
      { protocol: "https", hostname: "*.r2.dev", pathname: "/**" },
      { protocol: "https", hostname: "*.r2.cloudflarestorage.com", pathname: "/**" },
    ],
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    // playwright-core's full server bundle pulls in optional Electron/BiDi browser
    // support (chromium-bidi, electron) that we never use — leaving it unbundled
    // avoids webpack trying to statically resolve those missing optional deps.
    serverComponentsExternalPackages: ["playwright-core", "@sparticuz/chromium"],
  },
};

export default nextConfig;
