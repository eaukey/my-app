"use client";
import React, { useEffect } from "react";
import localFont from "next/font/local";
import "./globals.css";
import SideNav from "../components/SideNav";
import SavAssistant from "../components/SavAssistant";
import styles from "./Layout.module.css";
import { AuthProvider, useAuth } from "../lib/auth";

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

function Shell({ children }) {
  const { isAuthenticated } = useAuth();
  const showSideNav = isAuthenticated;

  return (
    <div className={styles.shell}>
      {showSideNav && <SideNav />}
      <div className={showSideNav ? styles.content : styles.contentNoNav}>
        {children}
      </div>
      <SavAssistant />
    </div>
  );
}

export default function RootLayout({ children }) {
  useEffect(() => {
    // Auparavant on enregistrait un service worker (/sw.js), mais ce fichier n'est
    // pas deploye (404) et un SW perime peut servir un ancien bundle en cache et
    // casser la connexion (boucle login). On desenregistre tout SW residuel + on
    // purge ses caches pour auto-reparer les navigateurs deja affectes.
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
    if (typeof caches !== "undefined") {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  }, []);

  return (
    <html lang="fr">
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="application-name" content="Eaukey" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Eaukey" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0ea5e9" />
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="icon" type="image/png" href="/icon-192x192.png" sizes="192x192" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <Shell>{children}</Shell>
        </AuthProvider>
      </body>
    </html>
  );
}
