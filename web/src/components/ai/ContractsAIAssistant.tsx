import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../lib/api';
import { Button } from '../ui/Button';
import { useVoiceInput, speak, stopSpeaking } from '../../hooks/useVoiceInput';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: AssistantAction[];
}

interface AssistantAction {
  type: 'navigate' | 'fill_field' | 'create_task' | 'explain' | 'suggest';
  label: string;
  data?: any;
}

interface ContractsAIAssistantProps {
  dealId?: string;
  formCode?: string;
  currentStep?: string;
  formData?: Record<string, any>;
  onNavigate?: (route: string) => void;
  onFillField?: (field: string, value: any) => void;
  onCreateTask?: (task: any) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

const REPC_FIELD_LABELS: Array<{ key: string; label: string }> = [
  { key: 'buyerLegalNames', label: 'Buyer Legal Names' },
  { key: 'sellerLegalNames', label: 'Seller Legal Names' },
  { key: 'purchasePrice', label: 'Purchase Price' },
  { key: 'earnestMoneyAmount', label: 'Earnest Money Amount' },
  { key: 'settlementDeadline', label: 'Settlement/Closing Date' },
  { key: 'dueDiligenceDeadline', label: 'Due Diligence Deadline' },
  { key: 'financingAppraisalDeadline', label: 'Financing/Appraisal Deadline' },
  { key: 'sellerDisclosureDeadline', label: 'Seller Disclosure Deadline' },
];

const getStorageKey = (dealId?: string, formCode?: string) => {
  const dealPart = dealId || 'global';
  const formPart = formCode || 'contracts';
  return `contracts_ai_${dealPart}_${formPart}`;
};

// Quick action prompts for common contract tasks
const quickActions = [
  { 
    label: 'Start a new REPC', 
    prompt: 'Help me start a new REPC contract', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )
  },
  { 
    label: 'Explain earnest money', 
    prompt: 'Explain how earnest money works in Utah', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  { 
    label: 'Check deadlines', 
    prompt: 'What deadlines should I be aware of?', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    )
  },
  { 
    label: 'Add addendum', 
    prompt: 'Help me add an addendum to my contract', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      </svg>
    )
  },
  { 
    label: 'Due diligence tips', 
    prompt: 'What should I do during due diligence?', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="11" cy="11" r="8" strokeWidth={2} />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.3-4.3" />
      </svg>
    )
  },
  { 
    label: 'Closing checklist', 
    prompt: 'Give me a closing checklist', 
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    )
  },
];

// Context-aware suggestions based on deal status
const contextSuggestions: Record<string, string[]> = {
  ACTIVE: [
    'Help me prepare an offer',
    'What contingencies should I include?',
    'Review my purchase price strategy',
  ],
  UNDER_CONTRACT: [
    'What are my upcoming deadlines?',
    'Help me track due diligence items',
    'Explain the financing contingency',
  ],
  DUE_DILIGENCE: [
    'What inspections do I need?',
    'How do I request repairs?',
    'Explain the resolution deadline',
  ],
  FINANCING: [
    'Track my loan approval status',
    'What happens if financing falls through?',
    'Explain the appraisal process',
  ],
};

export function ContractsAIAssistant({
  dealId,
  formCode,
  currentStep,
  formData,
  onNavigate,
  onFillField,
  onCreateTask,
  minimized = false,
  onToggleMinimize,
}: ContractsAIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [dealStatus, setDealStatus] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const storageKey = getStorageKey(dealId, formCode);

  // Voice input hook
  const { 
    isListening, 
    transcript, 
    isSupported: voiceSupported,
    toggleListening,
    resetTranscript,
    error: voiceError 
  } = useVoiceInput({
    onResult: (text) => {
      setInput(prev => prev + ' ' + text);
    },
  });

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Update input with voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Load deal context if dealId provided
  useEffect(() => {
    if (dealId) {
      loadDealContext();
    }
  }, [dealId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem(storageKey);
    if (!raw) {
      setMessages([]);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Array<Omit<Message, 'timestamp'> & { timestamp: string }>;
      const hydrated = parsed.map((msg) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      setMessages(hydrated);
    } catch (err) {
      console.warn('Failed to load AI conversation:', err);
      setMessages([]);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payload = messages.map((msg) => ({
      ...msg,
      timestamp: msg.timestamp.toISOString(),
    }));
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [messages, storageKey]);

  const loadDealContext = async () => {
    try {
      const res = await api.get(`/deals/${dealId}`);
      setDealStatus(res.data?.status || '');
    } catch (err) {
      console.error('Failed to load deal context:', err);
    }
  };

  // Send message to AI
  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    resetTranscript();
    setLoading(true);

    try {
      const res = await api.post('/ai/contracts/assist', {
        message: messageText,
        context: {
          dealId,
          formCode,
          currentStep,
          formData,
          dealStatus,
        },
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data.message || res.data.response,
        timestamp: new Date(),
        actions: res.data.actions,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again or rephrase your question.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAction = (action: AssistantAction) => {
    switch (action.type) {
      case 'navigate':
        onNavigate?.(action.data?.route);
        break;
      case 'fill_field':
        onFillField?.(action.data?.field, action.data?.value);
        break;
      case 'create_task':
        onCreateTask?.(action.data);
        break;
    }
  };

  const clearConversation = () => {
    setMessages([]);
    setInput('');
  };

  const getMissingFieldsMessage = () => {
    if (formCode !== 'REPC' || !formData) return '';
    const missing = REPC_FIELD_LABELS.filter((field) => {
      const value = (formData as any)[field.key];
      if (typeof value === 'number') return value <= 0;
      return !value;
    }).map((field) => field.label);

    if (!missing.length) {
      return 'My REPC looks complete. Can you double-check for any risks or deadline issues?';
    }
    return `Here are my missing REPC fields: ${missing.join(', ')}. Give me a prioritized checklist and suggested defaults.`;
  };

  const speakMessage = (content: string) => {
    if (isSpeaking) {
      stopSpeaking();
      setIsSpeaking(false);
    } else {
      setIsSpeaking(true);
      speak(content);
      // Estimate speech duration and reset state
      setTimeout(() => setIsSpeaking(false), content.length * 60);
    }
  };

  const getSuggestions = () => {
    if (dealStatus && contextSuggestions[dealStatus]) {
      return contextSuggestions[dealStatus];
    }
    return quickActions.slice(0, 3).map(a => a.prompt);
  };

  // Minimized state
  if (minimized) {
    return (
      <button
        onClick={onToggleMinimize}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl hover:scale-105 transition-transform"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
        <span className="font-semibold text-sm">AI Assistant</span>
        {messages.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-[600px] rounded-3xl border border-blue-500/30 bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Contracts AI</h3>
            <p className="text-xs text-slate-400">Your Utah real estate assistant</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {formData && (
            <button
              onClick={() => {
                const msg = getMissingFieldsMessage();
                if (msg) sendMessage(msg);
              }}
              className="hidden lg:inline-flex px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
            >
              Review My REPC
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={toggleListening}
              className={`p-2 rounded-xl transition-all ${
                isListening 
                  ? 'bg-red-500/20 text-red-400 animate-pulse' 
                  : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={isListening ? 'Stop listening' : 'Voice input'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          )}
          {onToggleMinimize && (
            <button
              onClick={onToggleMinimize}
              className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={clearConversation}
            className="p-2 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Clear conversation"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M6 6l1 14a2 2 0 002 2h6a2 2 0 002-2l1-14" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="space-y-6">
            {/* Welcome message */}
            <div className="text-center py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">Hi! I'm your Contracts Assistant</h4>
              <p className="text-sm text-slate-400 max-w-sm mx-auto">
                I can help you with REPC forms, explain contract terms, track deadlines, and guide you through the entire transaction process.
              </p>
            </div>

            {/* Quick actions */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">Quick Actions</p>
              <div className="grid grid-cols-2 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-left hover:bg-white/10 hover:border-blue-500/30 transition-all group"
                  >
                    <span className="text-slate-400 group-hover:text-blue-400 transition-colors">{action.icon}</span>
                    <span className="text-xs font-medium text-slate-300 group-hover:text-white">{action.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Context suggestions */}
            {dealStatus && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-1">
                  Suggestions for your {dealStatus.replace(/_/g, ' ').toLowerCase()} deal
                </p>
                <div className="space-y-1">
                  {getSuggestions().map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => sendMessage(suggestion)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-left hover:bg-blue-500/10 transition-colors group"
                    >
                      <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                      <span className="text-sm text-slate-300 group-hover:text-white">{suggestion}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                      : 'bg-white/10 text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  
                  {/* Assistant actions */}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-white/10">
                      {message.actions.map((action, i) => (
                        <button
                          key={i}
                          onClick={() => handleAction(action)}
                          className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-xs font-medium text-blue-300 hover:bg-blue-500/30 transition-colors"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Read aloud button for assistant messages */}
                  {message.role === 'assistant' && (
                    <button
                      onClick={() => speakMessage(message.content)}
                      className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      </svg>
                      {isSpeaking ? 'Stop' : 'Read aloud'}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-slate-400">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Voice error */}
      {voiceError && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-300">{voiceError}</p>
        </div>
      )}

      {/* Voice listening indicator */}
      {isListening && (
        <div className="px-4 py-2 bg-blue-500/10 border-t border-blue-500/20 flex items-center gap-2">
          <div className="flex space-x-1">
            <div className="w-1.5 h-3 bg-blue-400 rounded-full animate-pulse" />
            <div className="w-1.5 h-4 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="w-1.5 h-2 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-1.5 h-5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
            <div className="w-1.5 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
          <span className="text-xs text-blue-300">Listening... speak your question</span>
        </div>
      )}

      {/* Input area */}
      <div className="p-4 border-t border-white/10 bg-slate-900/50">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : 'Ask about contracts, deadlines, terms...'}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50"
              disabled={loading}
            />
            
            {voiceSupported && (
              <button
                onClick={toggleListening}
                className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg transition-colors ${
                  isListening
                    ? 'text-red-400 bg-red-500/20'
                    : 'text-slate-400 hover:text-blue-400 hover:bg-blue-500/10'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
          </div>
          
          <Button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            className="!rounded-xl !px-4"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </Button>
        </div>
        
        <p className="mt-2 text-[10px] text-slate-500 text-center">
          💡 AI is trained on Utah real estate practices • Not legal advice
        </p>
      </div>
    </div>
  );
}

export default ContractsAIAssistant;
