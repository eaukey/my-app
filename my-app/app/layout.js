"use client";
import React from "react";
import localFont from "next/font/local";
import "./globals.css";
import SideNav from "../components/SideNav";
import styles from "./Layout.module.css";
import { AuthProvider } from "../lib/auth";

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
        <AuthProvider>
          <div className={styles.shell}>
            <SideNav />
            <div className={styles.content}>
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
