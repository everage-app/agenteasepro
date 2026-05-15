import { Search, Filter, MessageCircle, Info } from 'lucide-react';
import React, { useState } from 'react';

// Example generic message model
interface Message {
  id: string;
  senderName: string;
  preview: string;
  time: string;
  unread: boolean;
  avatar: string;
}

export function MobileUnifiedInbox() {
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const messages: Message[] = [
    { id: '1', senderName: 'Eleanor Shellstrop', preview: 'Did the appraisal come back yet?', time: '10:42 AM', unread: true, avatar: 'https://i.pravatar.cc/150?u=1' },
    { id: '2', senderName: 'Tahani Al-Jamil', preview: 'Title commitment is ready for review.', time: 'Yesterday', unread: false, avatar: 'https://i.pravatar.cc/150?u=3' },
    { id: '3', senderName: 'Jason Mendoza', preview: 'I think I signed the wrong line on the addendum...', time: 'Mon', unread: true, avatar: 'https://i.pravatar.cc/150?u=4' },
  ];

  const filteredMessages = messages.filter(m => activeTab === 'all' || m.unread);

  return (
    <div className="flex flex-col h-[600px] w-full max-w-md mx-auto rounded-[2.5rem] bg-gradient-to-b from-[#1c1c2e] to-[#121220] border-[8px] border-black/90 shadow-2xl relative overflow-hidden">
      {/* Notch indicator */}
      <div className="absolute top-0 inset-x-0 h-6 flex justify-center">
        <div className="w-32 h-6 bg-black/90 rounded-b-2xl"></div>
      </div>

      {/* Header */}
      <div className="pt-12 pb-4 px-6 bg-white/5 backdrop-blur-md border-b border-white/10 z-10 sticky top-0">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
            Inbox
          </h1>
          <button className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <Filter className="w-5 h-5" />
          </button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search messages..." 
            className="w-full bg-black/40 border border-white/10 rounded-2xl py-2.5 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-shadow"
          />
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            All
          </button>
          <button 
            onClick={() => setActiveTab('unread')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'unread' ? 'bg-white/20 text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
          >
            Unread
          </button>
        </div>
      </div>

      {/* Message List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-4 pb-20 px-4 space-y-3 custom-scrollbar">
        {filteredMessages.map(msg => (
          <div key={msg.id} className="relative p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all cursor-pointer group flex gap-4">
            {msg.unread && (
              <div className="absolute top-4 right-4 w-2.5 h-2.5 bg-blue-500 rounded-full shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
            )}
            
            <img src={msg.avatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
              <div className="flex justify-between items-baseline mb-0.5">
                <span className={`text-base font-semibold truncate pr-4 ${msg.unread ? 'text-white' : 'text-gray-300'}`}>
                  {msg.senderName}
                </span>
                <span className={`text-xs whitespace-nowrap ${msg.unread ? 'text-blue-400 font-medium' : 'text-gray-500'}`}>
                  {msg.time}
                </span>
              </div>
              <p className={`text-sm truncate ${msg.unread ? 'text-gray-300' : 'text-gray-500'}`}>
                {msg.preview}
              </p>
            </div>
          </div>
        ))}

        {filteredMessages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 opacity-60 mt-12">
            <MessageCircle className="w-12 h-12 text-gray-500 mb-4" />
            <p className="text-gray-400">No messages in this view.</p>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <div className="absolute bottom-6 right-6 z-20">
        <button className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 shadow-lg shadow-purple-500/30 flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform">
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
