"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BarChart2, Settings, MessageCircle, FileText, Table } from "lucide-react";
import Image from "next/image";
import { useAuth0 } from "@auth0/auth0-react";

export default function SideNav() {
  const pathname = usePathname();
  const { user } = useAuth0();
  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";

  const links = [
    { icon: Home, href: "/", title: "Accueil" },
    { icon: BarChart2, href: "/stock", title: "Stock" },
    { icon: Settings, href: "/pilotage", title: "Pilotage" },
    ...(isAdmin ? [{ icon: Table, href: "/admin", title: "Automates" }] : []),
    { icon: MessageCircle, href: "/chat", title: "Chat" },
    { icon: FileText, href: "/documents", title: "Documents" },
  ];

  return (
    <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
      <div className="py-4">
        <Image
          src="/images/eaukey-logo.svg.png"
          alt="Eaukey Logo"
          width={48}
          height={48}
          className="w-12"
          priority
        />
      </div>
      <div className="flex flex-col items-center flex-grow space-y-6 mt-6">
        {links.map(({ icon: Icon, href, title }) => (
          <Link
            key={href}
            href={href}
            className={`w-12 h-12 flex items-center justify-center ${
              pathname === href ? "bg-white rounded-lg" : "hover:bg-white hover:bg-opacity-10 rounded-lg"
            }`}
            title={title}
          >
            <Icon size={24} className={pathname === href ? "text-[#41AEAD]" : "text-white"} />
          </Link>
        ))}
      </div>
    </div>
  );
} 