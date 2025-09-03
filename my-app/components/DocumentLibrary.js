"use client";
import React, { useState } from 'react';
import { Home, BarChart2, Settings, MessageCircle, FileText, Table, Search, Download, Video } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth0 } from '@auth0/auth0-react';
import styles from './DocumentLibrary.module.css';

const DocumentLibrary = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const pathname = usePathname();
  const { user } = useAuth0();
  const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
  
  const documents = [
    { id: 1, name: 'Guide d\'utilisation.pdf', type: 'pdf', size: '2,5 MB', date: '15/12/2024' },
    { id: 2, name: 'Tutoriel installation.mp4', type: 'video', size: '15 MB', date: '14/12/2024' },
    { id: 3, name: 'Documentation API.pdf', type: 'pdf', size: '1,2 MB', date: '13/12/2024' },
    { id: 4, name: 'Formation complète.mp4', type: 'video', size: '45 MB', date: '12/12/2024' }
  ];

  const filteredDocuments = documents.filter(doc =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-screen">
      {/* Barre latérale */}
      <div 
        className={`w-16 min-h-screen fixed flex flex-col items-center ${styles.sideNavHidden || ''}`}
        style={{ backgroundColor: '#41AEAD' }}
      >
        {/* Logo Eaukey */}
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

        {/* Navigation icons */}
        <div className="flex flex-col items-center flex-grow space-y-6 mt-6">
          {[
            { icon: Home, href: '/', title: 'Accueil' },
            { icon: BarChart2, href: '/stock', title: 'Stock' },
            { icon: Settings, href: '/pilotage', title: 'Pilotage' },
            ...(isAdmin ? [{ icon: Table, href: '/admin', title: 'Automates' }] : []),
            { icon: MessageCircle, href: '/chat', title: 'Chat' },
            { icon: FileText, href: '/documents', title: 'Documents' }
          ].map(({ icon: Icon, href, title }) => (
            <Link 
              key={href}
              href={href}
              className={`w-12 h-12 flex items-center justify-center ${
                pathname === href ? 'bg-white rounded-lg' : 'hover:bg-white hover:bg-opacity-10 rounded-lg'
              }`}
            >
              <Icon 
                size={24} 
                style={{ color: pathname === href ? '#41AEAD' : 'white' }}
                strokeWidth={pathname === href ? 2 : 1.5}
              />
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col bg-white ml-16 ${styles.mainFull || ''}`}>
        {/* Header */}
        <div className={`py-4 px-6 border-b ${styles.header || ''}`}>
          <h1 className="font-semibold text-gray-800">Documents</h1>
        </div>

        {/* Search bar */}
        <div className={`p-4 border-b ${styles.searchBarWrap || ''}`}>
          <div className="relative">
            <Search className={`absolute h-5 w-5 text-gray-400 ${styles.searchIcon || ''}`} />
            <input
              type="text"
              placeholder="Rechercher un document..."
              className={`w-full pl-10 pr-4 py-2 bg-gray-50 rounded-md border border-gray-200 ${styles.searchInput || ''}`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Document list */}
        <div className="flex-1 overflow-y-auto">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className={`flex items-center justify-between px-6 py-3 hover:bg-gray-50 border-b ${styles.docRow || ''}`}
              >
                <div className="flex items-center">
                  {doc.type === 'pdf' ? (
                    <FileText className={`w-5 h-5 mr-3 ${styles.docIcon || ''}`} style={{ color: '#ef4444' }} />
                  ) : (
                    <Video className={`w-5 h-5 mr-3 ${styles.docIcon || ''}`} style={{ color: '#3b82f6' }} />
                  )}
                  <div>
                    <div className={`text-sm font-medium text-gray-900 ${styles.docTitle || ''}`}>{doc.name}</div>
                    <div className={`text-xs text-gray-500 ${styles.docMeta || ''}`}>{doc.size} • Ajouté le {doc.date}</div>
                  </div>
                </div>
                <button className={`text-[#41AEAD] text-sm hover:underline flex items-center ${styles.downloadBtn || ''}`}>
                  <Download className="w-4 h-4 mr-1" />
                  Télécharger
                </button>
              </div>
            ))
          ) : (
            <div className="px-6 py-4 text-gray-500 text-center">
              Aucun document trouvé
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentLibrary;