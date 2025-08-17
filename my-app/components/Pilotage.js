"use client";
import React, { useState } from 'react';

// Composant ToggleSwitch
const ToggleSwitch = ({ isOn, onToggle, label }) => {
 return (
   <div className="flex items-center justify-between p-4 bg-white rounded-lg">
     <span className="capitalize text-gray-700">{label.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
     <label className="relative inline-block w-16 h-8 cursor-pointer">
       <input
         type="checkbox"
         className="hidden"
         checked={isOn}
         onChange={onToggle}
       />
       <div 
         className={`absolute top-0 left-0 right-0 bottom-0 
           ${isOn ? 'bg-green-500' : 'bg-gray-300'}
           rounded-full transition-all duration-300`
         }
       >
         <div 
           className={`absolute top-1 left-1 
             bg-white w-6 h-6 rounded-full shadow-md 
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
   <div className="p-8 bg-gray-50 min-h-screen">
     <main className="w-full">
       <h1 className="text-2xl font-bold mb-6">Page Pilotage</h1>
       {/* État des variables */}
       <div className="bg-white p-6 rounded-lg shadow mb-6">
         <div className="grid gap-6">
           {/* Section variables binaires */}
           <div>
             <h2 className="text-lg font-semibold mb-4">Variables Binaires</h2>
             <div className="grid grid-cols-4 gap-4">
               {Object.entries(variables)
                 .filter(([key, value]) => typeof value === 'boolean')
                 .map(([key, value]) => (
                   <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                     <span className="capitalize">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}</span>
                     <div className={`w-4 h-4 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`} />
                   </div>
                 ))}
             </div>
           </div>

           {/* Section variables réelles */}
           <div>
             <h2 className="text-lg font-semibold mb-4">Variables Réelles</h2>
             <div className="grid grid-cols-4 gap-4">
               {Object.entries(variables)
                 .filter(([key, value]) => typeof value === 'number')
                 .map(([key, value]) => (
                   <div key={key} className="p-3 bg-gray-50 rounded-lg">
                     <span className="block text-sm capitalize">
                       {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                     </span>
                     <div className="flex justify-between items-center mt-2">
                       <span className="font-bold">{value.toFixed(1)}</span>
                       <span className="text-sm text-gray-600">
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
       <div className="bg-white p-6 rounded-lg shadow">
         <h2 className="text-lg font-semibold mb-4">Contrôles</h2>
         <div className="grid grid-cols-4 gap-4">
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
 );
}