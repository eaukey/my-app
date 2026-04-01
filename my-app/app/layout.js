"use client";
import React, { useEffect } from "react";
import localFont from "next/font/local";
import "./globals.css";
import SideNav from "../components/SideNav";
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
    </div>
  );
}

export default function RootLayout({ children }) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js");
    }
  }, []);

  return (
    <html lang="fr">
      <head>
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
