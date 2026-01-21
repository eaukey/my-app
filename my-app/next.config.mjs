import path from "path";

// Active le mock par défaut en développement.
// Pour tester le vrai Auth0 en local :  NEXT_PUBLIC_USE_REAL_AUTH=true npm run dev
const isMock =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_USE_REAL_AUTH !== "true";

/**
 * Next.js configuration
 * Lorsque NEXT_PUBLIC_MOCK_AUTH=true (dev local), on remplace
 *  @auth0/auth0-react par /mocks/auth0-react.js pour tester sans Auth0.
 */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    if (isMock) {
      config.resolve.alias["@auth0/auth0-react"] = path.join(
        process.cwd(),
        "mocks",
        "auth0-react.js"
      );
    }
    return config;
  },
};

export default nextConfig;
