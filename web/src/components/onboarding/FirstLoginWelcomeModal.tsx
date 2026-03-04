import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../features/auth/authStore';
import { ModalPrimaryButton, StunningModal } from '../ui/StunningModal';

const firstLoginWelcomeKey = (agentId: string) => `aep_first_login_welcome_${agentId}`;

export function FirstLoginWelcomeModal() {
  const navigate = useNavigate();
  const agent = useAuthStore((s) => s.agent);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!agent?.id) return;
    const shouldShow = localStorage.getItem(firstLoginWelcomeKey(agent.id)) === '1';
    if (!shouldShow) return;
    setOpen(true);
    localStorage.removeItem(firstLoginWelcomeKey(agent.id));
  }, [agent?.id]);

  const firstName = agent?.name?.trim()?.split(' ')[0] || 'there';
  const termsUrl = 'https://app.agenteasepro.com/legal/terms.html';
  const privacyUrl = 'https://app.agenteasepro.com/legal/privacy.html';

  return (
    <StunningModal
      isOpen={open}
      onClose={() => setOpen(false)}
      title={`Welcome to AgentEase Pro, ${firstName}`}
      subtitle="Your workspace is ready — let's help you get momentum fast."
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      }
      iconGradient="from-emerald-500 to-cyan-500"
      size="md"
      footer={
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/dashboard');
            }}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-200 hover:bg-white/10 text-sm font-medium"
          >
            Explore Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/deals/new');
            }}
            className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-200 hover:bg-white/10 text-sm font-medium"
          >
            Start First Deal
          </button>
          <ModalPrimaryButton
            onClick={() => {
              setOpen(false);
              navigate('/clients');
            }}
          >
            Add First Client
          </ModalPrimaryButton>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-slate-300">
        <p className="text-slate-200">You now have everything to run Utah deals in one place.</p>
        <div className="rounded-xl border border-white/10 bg-white/5 p-3">
          <ul className="space-y-1.5 text-xs">
            <li>• Draft and send contracts with guided e-sign flow</li>
            <li>• Track every deadline automatically from one dashboard</li>
            <li>• Keep clients, tasks, and follow-ups organized from day one</li>
          </ul>
        </div>
        <p className="text-[11px] text-slate-400">
          Legal:{' '}
          <a href={termsUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
            Terms
          </a>{' '}
          ·{' '}
          <a href={privacyUrl} target="_blank" rel="noreferrer" className="text-cyan-300 hover:text-cyan-200 underline underline-offset-2">
            Privacy
          </a>
        </p>
      </div>
    </StunningModal>
  );
}

export default FirstLoginWelcomeModal;
