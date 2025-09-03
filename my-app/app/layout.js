"use client";
import React from "react";
import { Auth0Provider } from "@auth0/auth0-react";
import localFont from "next/font/local";
import "./globals.css";
import SideNav from "../components/SideNav";
import styles from "./Layout.module.css";

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
            redirect_uri: "https://my-app-zeta-blue.vercel.app/",
          }}
          cacheLocation="localstorage"
        >
          <div className={styles.shell}>
            <SideNav />
            <div className={styles.content}>
              {children}
            </div>
          </div>
        </Auth0Provider>
      </body>
    </html>
  );
}
