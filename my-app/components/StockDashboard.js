"use client";
import React, { useState } from 'react';
import { Home, BarChart2, Settings, MessageCircle, FileText, PlusCircle, MinusCircle } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

export default function StockDashboard() {
 const pathname = usePathname();
 
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
     {/* Barre latérale */}
     <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
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
               className={pathname === href ? 'text-[#41AEAD]' : 'text-white'} 
             />
           </Link>
         ))}
       </div>
     </div>

     {/* Contenu principal */}
     <div className="flex-1 p-8 ml-16">
       <div className="grid grid-cols-3 gap-8">
         {stocks.map((item) => (
           <div key={item.id} className="bg-white shadow-sm h-[120px] rounded-lg">
             <div className="p-4">
               <div className="flex items-center justify-between mb-2">
                 <div className="font-medium">{item.name}</div>
                 <div className="flex items-center space-x-4">
                   <div className="text-2xl font-bold text-gray-900">
                     {item.quantity}
                   </div>
                   <div className="flex space-x-2">
                     <button 
                       onClick={() => handleDecrease(item.id)}
                       className="p-1.5 rounded-full text-white hover:opacity-80"
                       style={{ backgroundColor: '#41AEAD' }}
                       aria-label="Retirer du stock"
                     >
                       <MinusCircle className="h-5 w-5" />
                     </button>
                     <button 
                       onClick={() => handleIncrease(item.id)}
                       className="p-1.5 rounded-full text-white hover:opacity-80"
                       style={{ backgroundColor: '#41AEAD' }}
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