"use client";
import React, { useState } from 'react';
import { Home, BarChart2, Settings, MessageCircle, FileText, Table, PlusCircle, MinusCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth0 } from '@auth0/auth0-react';
import styles from './StockDashboard.module.css';

export default function StockDashboard() {
 const pathname = usePathname();
 const { user } = useAuth0();
 const isAdmin = (user?.["https://app.com/role"] || user?.role) === "admin";
 
 const [stocks, setStocks] = useState([
   { id: 1, name: 'Filtre 5 microns', quantity: 15 },
   { id: 2, name: 'Filtre 20 microns', quantity: 12 },
   { id: 3, name: 'Chlore liquide', quantity: 25 },
   { id: 4, name: 'pH-', quantity: 20 },
   { id: 5, name: 'pH+', quantity: 18 },
   { id: 6, name: 'Agglomérant 1', quantity: 8 },
   { id: 7, name: 'Agglomérant 2', quantity: 10 },
   { id: 8, name: 'Kit UV', quantity: 5 },
   { id: 9, name: 'Charbon actif', quantity: 6 }
 ]);

 const handleIncrease = (id) => {
   setStocks(stocks.map(item => {
     if (item.id === id) {
       return { ...item, quantity: item.quantity + 1 };
     }
     return item;
   }));
 };

 const handleDecrease = (id) => {
   setStocks(stocks.map(item => {
     if (item.id === id && item.quantity > 0) {
       return { ...item, quantity: item.quantity - 1 };
     }
     return item;
   }));
 };

 return (
   <div className="flex h-screen bg-gray-50">
     {/* Barre latérale - déjà gérée globalement via SideNav dans le layout */}

     {/* Contenu principal */}
     <div className={styles.container}>
       <div className={styles.grid}>
         {stocks.map((item) => (
           <div key={item.id} className={styles.card}>
             <div className={styles.cardInner}>
                               <div className={styles.cardHeader}>
                  <div className={styles.label}><span>{item.name}</span></div>
                  <div className={styles.valueRow}>
                    <div className={styles.value}>
                      {item.quantity}
                    </div>
                    <div className={styles.actions}>
                      <button 
                        onClick={() => handleDecrease(item.id)}
                        className={styles.actionBtn}
                        aria-label="Retirer du stock"
                      >
                        <MinusCircle className="h-5 w-5" />
                      </button>
                      <button 
                        onClick={() => handleIncrease(item.id)}
                        className={styles.actionBtn}
                        aria-label="Ajouter au stock"
                      >
                        <PlusCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                </div>
             </div>
           </div>
         ))}
       </div>
     </div>
   </div>
 );
}