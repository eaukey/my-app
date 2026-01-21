"use client";
import React, { useState } from 'react';
import { Home, BarChart2, Settings, MessageCircle, FileText, Table } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '../lib/auth';
import styles from './Pilotage.module.css';

// Composant ToggleSwitch
const ToggleSwitch = ({ isOn, onToggle, label }) => {
  return (
    <div className={`flex items-center justify-between p-4 bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-lg ${styles.itemRow || ''}`}>
      <span className={`capitalize text-[var(--text-primary)] ${styles.label || ''}`}>{label.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
      <label className="relative inline-block w-16 h-8 cursor-pointer">
        <input
          type="checkbox"
          className="hidden"
          checked={isOn}
          onChange={onToggle}
        />
        <div 
          className={`absolute top-0 left-0 right-0 bottom-0 
            ${isOn ? 'bg-[var(--success)]' : 'bg-[var(--border-subtle)]'}
            rounded-full transition-all duration-300`
          }
        >
          <div 
            className={`absolute top-1 left-1 
              bg-[var(--bg-base)] w-6 h-6 rounded-full shadow-md 
              transition-transform duration-300
              ${isOn ? 'transform translate-x-8' : 'transform translate-x-0'}`
            }
          />
        </div>
      </label>
    </div>
  );
};

export default function PilotageDashboard() {
 const pathname = usePathname();
 const { user } = useAuth();
 const isAdmin = Array.isArray(user?.roles) && user.roles.includes("admin");
 const [binaryControls, setBinaryControls] = useState({
   relevage: false,
   stopSwitchRelevage: false,
   agitationAgglos: false,
   melangeurAgglo2: false,
   filtration: false,
   stopSwitchFiltration: false,
   chloration: false,
   bulleur: false,
   renvoi: false,
   stopSwitchRenvoi: false,
   lumiere: false,
   nouveauBidonAgglo1: false,
   nouveauBidonAgglo2: false
 });

 const [variables, setVariables] = useState({
   // Variables binaires
   relevage: false,
   agitationAgglo1: false,
   agitationAgglo2: false,
   filtration: false,
   chloration: false,
   bulleur: false,
   renvoi: false,
   evStation: false,
   evAdoucie: false,
   flotteurRelevage: false,
   flotteurTraitement: false,
   flotteurRenvoi: false,
   lumiere: false,
   // Variables réelles
   volumeRelevage: 0.0,
   volumeAdoucie: 0.0,
   volumeRenvoi: 0.0,
   capteurPressionAvFiltre20: 0.0,
   capteurPressionAvFiltre5: 0.0,
   capteurPressionAvCharbonActif: 0.0,
   capteurPressionStation: 0.0,
   temperature: 0.0,
   pH: 7.0,
   redox: 0.0,
   conductiviteTraitement: 0.0,
   conductiviteRenvoi: 0.0
 });

 const toggleControl = (key) => {
   setBinaryControls(prev => ({
     ...prev,
     [key]: !prev[key]
   }));
 };

 return (
       <div className="flex h-screen bg-[var(--bg-base)] text-[var(--text-primary)]">
      {/* Barre latérale interne supprimée: on utilise la side nav globale du layout */}

      {/* Contenu principal */}
      <div className={`flex-1 p-8 ${styles.mainMobileFull || ''}`}>
        <main className={`w-full ${styles.container || ''}`}>
         <h1 className="text-2xl font-bold mb-6">Page Pilotage</h1>
         
         {/* État des variables */}
         <div className={`bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 rounded-lg shadow-[0_18px_50px_rgba(0,0,0,0.35)] mb-6 ${styles.sectionCard || ''}`}>
           <div className="grid gap-6">
             {/* Section variables binaires */}
             <div>
               <h2 className={`text-lg font-semibold mb-4 ${styles.title || ''}`}>Variables Binaires</h2>
               <div className={`grid grid-cols-4 gap-4 ${styles.gridMobileOneCol || ''}`}>
                 {Object.entries(variables)
                   .filter(([key, value]) => typeof value === 'boolean')
                   .map(([key, value]) => (
                     <div key={key} className={`flex items-center justify-between p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg ${styles.itemRow || ''}`}>
                       <span className={`capitalize ${styles.label || ''}`}>{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                       <div className={`w-4 h-4 rounded-full ${value ? 'bg-[var(--success)]' : 'bg-[var(--critical)]'} ${styles.valuePill || ''}`} />
                     </div>
                   ))}
               </div>
             </div>

             {/* Section variables réelles */}
             <div>
               <h2 className={`text-lg font-semibold mb-4 ${styles.title || ''}`}>Variables Réelles</h2>
               <div className={`grid grid-cols-4 gap-4 ${styles.gridMobileOneCol || ''}`}>
                 {Object.entries(variables)
                   .filter(([key, value]) => typeof value === 'number')
                   .map(([key, value]) => (
                     <div key={key} className={`p-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-lg ${styles.itemRow || ''}`}>
                       <span className={`block text-sm capitalize ${styles.label || ''}`}>
                         {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                       </span>
                       <div className="flex justify-between items-center mt-2">
                         <span className="font-bold">{value.toFixed(1)}</span>
                         <span className="text-sm text-[var(--text-secondary)]">
                           {key.includes('volume') ? 'm³' :
                            key.includes('Pression') ? 'mbar' :
                            key.includes('temperature') ? '°C' :
                            key.includes('redox') ? 'mV' :
                            key.includes('conductivite') ? 'µS/cm' : ''}
                         </span>
                       </div>
                     </div>
                   ))}
               </div>
             </div>
           </div>
         </div>

         {/* Boutons de contrôle */}
         <div className={`bg-[var(--bg-elevated)] border border-[var(--border-strong)] p-6 rounded-lg shadow-[0_18px_50px_rgba(0,0,0,0.35)] ${styles.sectionCard || ''}`}>
           <h2 className={`text-lg font-semibold mb-4 ${styles.title || ''}`}>Contrôles</h2>
           <div className={`grid grid-cols-4 gap-4 ${styles.gridMobileOneCol || ''}`}>
             {Object.entries(binaryControls).map(([key, value]) => (
               <ToggleSwitch
                 key={key}
                 isOn={value}
                 onToggle={() => toggleControl(key)}
                 label={key}
               />
             ))}
           </div>
         </div>
       </main>
     </div>
   </div>
 );
}