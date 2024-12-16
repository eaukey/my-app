'use client';
import dynamic from 'next/dynamic';

const StockDashboard = dynamic(() => import('../../components/StockDashboard'), {
  ssr: false
});

export default function StockPage() {
  return (
    <div>
      <StockDashboard />
    </div>
  );
}