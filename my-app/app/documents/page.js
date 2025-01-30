'use client';
import dynamic from 'next/dynamic';

const DocumentLibraryComponent = dynamic(() => import('../../components/DocumentLibrary'), {
  ssr: false
});

export default function DocumentPage() {
  return <DocumentLibraryComponent />;
}