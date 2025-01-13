import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";

function MyApp({ Component, pageProps }) {
  return (
    <Auth0Provider
      domain="dev-403isex3agfwatlk.us.auth0.com"
      clientId="TEAUBho90QHtubuZwg5qZh5juRSWBeVd"
      authorizationParams={{
        redirect_uri: window.location.origin,
      }}
    >
      <Component {...pageProps} />
    </Auth0Provider>
  );
}

console.log("Auth0Provider initialisé avec le domaine:", "dev-403isex3agfwatlk.us.auth0.com");

export default MyApp;
