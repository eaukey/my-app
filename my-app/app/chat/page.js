'use client';
import dynamic from 'next/dynamic';

const ChatComponent = dynamic(() => import('../../components/ChatDashboard'), {
  ssr: false
});

export default function ChatPage() {
  return <ChatComponent />;
}