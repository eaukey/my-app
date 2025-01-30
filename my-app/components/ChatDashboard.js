"use client";
import React, { useState, useRef } from 'react';
import { Home, BarChart2, Settings, MessageCircle, FileText, PlusCircle, Send, Paperclip, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

const ChatDashboard = () => {
  const fileInputRef = useRef(null);
  const [activeType, setActiveType] = useState('support');
  const [activeDiscussionId, setActiveDiscussionId] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [showOtherMenu, setShowOtherMenu] = useState(false);
  const pathname = usePathname();

  // Types de discussion disponibles
  const discussionTypes = [
    { id: 'support', name: 'Support technique' },
    { id: 'sav', name: 'SAV' },
    { id: 'material', name: 'Commande matériel' }
  ];

  // État initial des discussions
  const [discussions, setDiscussions] = useState({
    support: [],
    sav: [],
    material: []
  });

  // Ajouter une nouvelle discussion
  const handleAddDiscussion = (type) => {
    const newDiscussion = {
      id: Date.now(),
      name: `Discussion ${discussions[type].length + 1}`,
      messages: [{
        id: Date.now(),
        text: type === 'support' 
          ? "Bonjour, comment puis-je vous aider ?"
          : type === 'sav'
          ? "Bonjour, que puis-je faire pour vous concernant le service après-vente ?"
          : "Bonjour, quelle commande souhaitez-vous passer ?",
        timestamp: new Date().toLocaleTimeString(),
        sender: 'support'
      }]
    };

    setDiscussions(prev => ({
      ...prev,
      [type]: [...prev[type], newDiscussion]
    }));
    setActiveDiscussionId(newDiscussion.id);
  };

  // Obtenir les types de discussion disponibles pour le menu "Autre discussion"
  const getOtherTypes = () => {
    return discussionTypes.filter(type => type.id !== activeType);
  };

  // Changer de type de discussion
  const handleTypeChange = (type) => {
    setActiveType(type);
    setShowOtherMenu(false);
    if (discussions[type].length === 0) {
      handleAddDiscussion(type);
    } else {
      setActiveDiscussionId(discussions[type][0].id);
    }
  };

  // Obtenir la discussion active
  const getCurrentDiscussion = () => {
    return discussions[activeType].find(d => d.id === activeDiscussionId) || discussions[activeType][0];
  };

  // Envoyer un message
  const handleSend = () => {
    if (!newMessage.trim() && !selectedFile) return;

    const newMsg = {
      id: Date.now(),
      text: newMessage.trim(),
      timestamp: new Date().toLocaleTimeString(),
      sender: 'user',
      file: selectedFile ? {
        name: selectedFile.name,
        type: selectedFile.type,
        url: URL.createObjectURL(selectedFile)
      } : null
    };

    setDiscussions(prev => ({
      ...prev,
      [activeType]: prev[activeType].map(disc => {
        if (disc.id === activeDiscussionId) {
          return {
            ...disc,
            messages: [...disc.messages, newMsg]
          };
        }
        return disc;
      })
    }));

    setNewMessage('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Barre latérale */}
      <div className="w-16 min-h-screen fixed bg-[#41AEAD] flex flex-col items-center">
        {/* Logo Eaukey */}
        <div className="py-4 flex justify-center">
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white ml-16">
        {/* Header */}
        <div className="border-b">
          {/* Navigation principale */}
          <div className="flex justify-between px-4 py-2 border-b">
            <div className="font-medium">{discussionTypes.find(t => t.id === activeType)?.name}</div>
            <div className="relative">
              <button
                className="text-gray-600 hover:text-gray-800"
                onClick={() => setShowOtherMenu(!showOtherMenu)}
              >
                Autre discussion
              </button>
              {showOtherMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-lg py-1 z-10">
                  {getOtherTypes().map(type => (
                    <button
                      key={type.id}
                      className="w-full text-left px-4 py-2 hover:bg-gray-100 text-gray-600"
                      onClick={() => handleTypeChange(type.id)}
                    >
                      {type.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Onglets de discussion */}
          <div className="flex items-center px-4 py-2">
            {discussions[activeType].map(disc => (
              <button
                key={disc.id}
                className={`mr-4 px-4 py-2 rounded-lg ${
                  activeDiscussionId === disc.id
                    ? 'bg-gray-100 text-[#41AEAD]'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                onClick={() => setActiveDiscussionId(disc.id)}
              >
                {disc.name}
              </button>
            ))}
            <button
              className="p-2 text-gray-600 hover:text-gray-800"
              onClick={() => handleAddDiscussion(activeType)}
            >
              <PlusCircle size={20} />
            </button>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {getCurrentDiscussion()?.messages.map((message) => (
              <div 
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                  <p className="text-gray-800">{message.text}</p>
                  {message.file && (
                    <div 
                      onClick={() => window.open(message.file.url, '_blank')}
                      className="mt-2 p-2 bg-white bg-opacity-80 rounded flex items-center gap-2 cursor-pointer"
                    >
                      <Paperclip className="w-4 h-4 text-[#41AEAD]" />
                      <span className="text-sm text-gray-600">{message.file.name}</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-500 mt-1 block">
                    {message.timestamp}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="px-4 py-3 border-t">
          {selectedFile && (
            <div className="mb-2 p-2 bg-gray-100 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Paperclip className="w-4 h-4 text-gray-500" />
                <span className="text-sm text-gray-600">{selectedFile.name}</span>
              </div>
              <button 
                onClick={() => setSelectedFile(null)}
                className="p-1 hover:bg-gray-200 rounded-full"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          )}
          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            <label 
              htmlFor="file-input" 
              className="cursor-pointer p-2 text-gray-400 hover:text-gray-600"
            >
              <Paperclip className="w-5 h-5" />
            </label>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Écrivez votre message..."
              className="flex-1 focus:outline-none"
            />
            <button
              onClick={handleSend}
              className="p-2 text-[#41AEAD]"
              disabled={!newMessage.trim() && !selectedFile}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatDashboard;