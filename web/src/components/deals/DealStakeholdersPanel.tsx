import { Mail, Phone, MessageSquare, MoreHorizontal } from 'lucide-react';
import React from 'react';

interface Stakeholder {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  avatarUrl?: string;
}

export function DealStakeholdersPanel() {
  const stakeholders: Stakeholder[] = [
    { id: '1', name: 'Eleanor Shellstrop', role: 'Buyer', email: 'eleanor@example.com', phone: '(555) 123-4567', avatarUrl: 'https://i.pravatar.cc/150?u=1' },
    { id: '2', name: 'Chidi Anagonye', role: 'Selling Agent', email: 'chidi@example.com', phone: '(555) 987-6543', avatarUrl: 'https://i.pravatar.cc/150?u=2' },
    { id: '3', name: 'Tahani Al-Jamil', role: 'Escrow Officer', email: 'tahani@escrow.com', phone: '(555) 555-5555', avatarUrl: 'https://i.pravatar.cc/150?u=3' },
  ];

  return (
    <div className="rounded-3xl bg-white/5 backdrop-blur-2xl border border-white/10 p-6 shadow-xl w-full">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-white tracking-tight">Deal Stakeholders</h2>
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <MoreHorizontal className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      <div className="space-y-4">
        {stakeholders.map((person) => (
          <div key={person.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group">
            <div className="flex items-center gap-4 mb-4 sm:mb-0">
              <div className="relative">
                <img src={person.avatarUrl} alt={person.name} className="w-12 h-12 rounded-full object-cover border-2 border-white/10 group-hover:border-blue-400/50 transition-colors" />
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#1a1a2e] rounded-full"></div>
              </div>
              <div>
                <h3 className="text-md font-medium text-gray-100">{person.name}</h3>
                <p className="text-sm text-gray-400">{person.role}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto ml-16 sm:ml-0">
              <a href={`mailto:${person.email}`} className="p-2.5 rounded-xl bg-white/5 hover:bg-blue-500/20 hover:text-blue-400 text-gray-300 transition-all border border-transparent hover:border-blue-500/30">
                <Mail className="h-4 w-4" />
              </a>
              <a href={`tel:${person.phone}`} className="p-2.5 rounded-xl bg-white/5 hover:bg-green-500/20 hover:text-green-400 text-gray-300 transition-all border border-transparent hover:border-green-500/30">
                <Phone className="h-4 w-4" />
              </a>
              <button className="p-2.5 rounded-xl bg-white/5 hover:bg-purple-500/20 hover:text-purple-400 text-gray-300 transition-all border border-transparent hover:border-purple-500/30">
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
