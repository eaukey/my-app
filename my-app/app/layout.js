"use client";
import React from "react";
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
  return (
    <html lang="fr">
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
