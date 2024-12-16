'use client';
import dynamic from 'next/dynamic';

const PilotageComponent = dynamic(() => import('../../components/Pilotage'), {
  ssr: false
});

export default function PilotagePage() {
  return <PilotageComponent />;
}