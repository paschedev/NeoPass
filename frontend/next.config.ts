import type { NextConfig } from "next";
import { securityHeaders } from "./src/utils/security-headers";

// Lo privado no va a Google: el panel, el checkout y la recuperación de la
// contraseña. Sale en la respuesta, antes de que cargue la página.
const PRIVATE_ROUTES = [
  "/panel/:path*",
  "/checkout/:path*",
  "/password-recovery",
  "/reset-password",
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders({
          apiUrl: process.env.NEXT_PUBLIC_API_URL,
          development: process.env.NODE_ENV === "development",
        }),
      },
      ...PRIVATE_ROUTES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      })),
    ];
  },
};

export default nextConfig;
