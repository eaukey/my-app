import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

function MyApp({ Component, pageProps }) {
  // Évite l’accès à "window" lors du rendu côté serveur
  const redirectUri = typeof window !== "undefined" ? window.location.origin : undefined;

  return (
    <Auth0Provider
      domain="dev-403isex3agfwatlk.us.auth0.com"
      clientId="TEAUBho90QHtubuZwg5qZh5juRSWBeVd"
      authorizationParams={{
        redirect_uri: redirectUri,
      }}
    >
      <Component {...pageProps} />
    </Auth0Provider>
  );
}

console.log("Auth0Provider initialisé avec le domaine:", "dev-403isex3agfwatlk.us.auth0.com");

export default MyApp;
