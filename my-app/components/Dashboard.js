"use client";
import React, { useState } from 'react';
import { Home, BarChart2, LineChart, MessageCircle, FileText, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LineChart as RechartsLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const LoginButton = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setShowModal(!showModal)}
        style={{
          padding: '8px',
          border: '1px solid #E5E7EB',
          borderRadius: '8px',
          backgroundColor: 'white',
          cursor: 'pointer'
        }}
      >
        <User size={20} />
      </button>

      {showModal && (
        <div style={{
          position: 'absolute',
          top: '100%',
          right: 0,
          marginTop: '8px',
          backgroundColor: 'white',
          padding: '16px',
          borderRadius: '8px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          width: '250px',
          zIndex: 1000
        }}>
          <input
            type="email"
            placeholder="Email"
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              border: '1px solid #E5E7EB',
              borderRadius: '4px'
            }}
          />
          <input
            type="password"
            placeholder="Mot de passe"
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              border: '1px solid #E5E7EB',
              borderRadius: '4px'
            }}
          />
          <button style={{
            width: '100%',
            padding: '8px',
            backgroundColor: '#41AEAD',
            color: 'white',
            border: 'none',
            borderRadius: '4px'
          }}>
            Se connecter
          </button>
        </div>
      )}
    </div>
  );
};

const GraphComponent = ({ title, color, selectedPeriod }) => {
  const generateData = (selectedPeriod) => {
    const data = [];
    
    switch(selectedPeriod) {
      case 'Jour':
        for(let i = 0; i < 24; i++) {
          data.push({
            name: `${String(i).padStart(2, '0')}:00`,
            value: Math.floor(Math.random() * 100)
          });
        }
        break;
        
      case 'Semaine':
        const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
        jours.forEach(jour => {
          data.push({
            name: jour,
            value: Math.floor(Math.random() * 100)
          });
        });
        break;
        
      case 'Mois':
        for(let i = 1; i <= 4; i++) {
          data.push({
            name: `Semaine ${i}`,
            value: Math.floor(Math.random() * 100)
          });
        }
        break;
        
      case 'Année':
        const mois = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
        mois.forEach(mois => {
          data.push({
            name: mois,
            value: Math.floor(Math.random() * 100)
          });
        });
        break;
    }
    
    return data;
  };

  return (
    <div style={{
      backgroundColor: 'white',
      padding: '16px',
      borderRadius: '8px',
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
    }}>
      <h3 style={{ marginBottom: '16px' }}>{title}</h3>
      <div style={{ height: '200px' }}>
        <ResponsiveContainer>
          <RechartsLineChart data={generateData(selectedPeriod)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name"
              interval={selectedPeriod === 'Jour' ? 3 : 0}
            />
            <YAxis />
            <Tooltip />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke={color} 
              strokeWidth={2}
            />
          </RechartsLineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const pathname = usePathname();
  const [selectedPeriod, setSelectedPeriod] = useState('Jour');
  const [selectedMachine, setSelectedMachine] = useState('Machine 1');
  const [machines, setMachines] = useState(['Machine 1', 'Machine 2', 'Machine 3']);
  const periods = ['Jour', 'Semaine', 'Mois', 'Année'];

  return (
    <div className="flex h-screen bg-gray-50">
      <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
        <div className="py-4">
          <svg viewBox="0 0 100 120" className="w-12">
            <path 
              d="M50 5 L95 60 L95 90 L50 115 L5 90 L5 60 Z" 
              fill="white"
              stroke="none"
            />
            <path
              d="M25 80 L75 80 M20 85 L80 85"
              stroke="white"
              strokeWidth="2"
              fill="none"
            />
            <text
              x="50"
              y="70"
              textAnchor="middle"
              fill="#41AEAD"
              style={{
                fontSize: '16px',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              Eaukey
            </text>
          </svg>
        </div>

        <div className="flex flex-col items-center flex-grow space-y-6 mt-6">
          {[
            { icon: Home, href: '/', title: 'Accueil' },
            { icon: BarChart2, href: '/stock', title: 'Stock' },
            { icon: LineChart, href: '/pilotage', title: 'Pilotage' },
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

      <div className="flex-1 p-8 ml-16">
        <div style={{ 
          marginBottom: '24px',
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <LoginButton />
        </div>

        <div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {periods.map(period => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: selectedPeriod === period ? '#41AEAD' : '#E5E7EB',
                    color: selectedPeriod === period ? 'white' : 'black',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {period}
                </button>
              ))}
            </div>

            <select
              value={selectedMachine}
              onChange={(e) => {
                if (e.target.value === 'add-new') {
                  const name = prompt('Entrez le nom de la nouvelle machine:');
                  if (name) {
                    setMachines([...machines, name]);
                    setSelectedMachine(name);
                  }
                } else {
                  setSelectedMachine(e.target.value);
                }
              }}
              style={{
                padding: '8px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                minWidth: '200px'
              }}
            >
              {machines.map(machine => (
                <option key={machine} value={machine}>{machine}</option>
              ))}
              <option value="add-new">+ Ajouter une machine</option>
            </select>
          </div>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, 1fr)', 
            gap: '16px' 
          }}>
            <GraphComponent title="Volume renvoi (m³)" color="#2196F3" selectedPeriod={selectedPeriod} />
            <GraphComponent title="Volume adoucie (m³)" color="#4CAF50" selectedPeriod={selectedPeriod} />
            <GraphComponent title="Volume relevage (m³)" color="#FF9800" selectedPeriod={selectedPeriod} />
            <GraphComponent title="Recyclage (%)" color="#E91E63" selectedPeriod={selectedPeriod} />
            <GraphComponent title="Pression station (mbar)" color="#9C27B0" selectedPeriod={selectedPeriod} />
            <GraphComponent title="Taux désinfection (%)" color="#795548" selectedPeriod={selectedPeriod} />
          </div>
        </div>
      </div>
    </div>
  );
}