"use client";
import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import localFont from "next/font/local";
import "./globals.css";

// Import des polices
const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});


export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Auth0Provider
  domain="dev-403isex3agfwatlk.us.auth0.com"
  clientId="TEAUBho90QHtubuZwg5qZh5juRSWBeVd"
  authorizationParams={{
    redirect_uri: "http://localhost:3001",
  }}
  cacheLocation="localstorage"
>
  {children}
</Auth0Provider>
      </body>
    </html>
  );
}
