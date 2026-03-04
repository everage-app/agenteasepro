import { useEffect, useState } from 'react';
import api from '../../lib/api';

interface Subscription {
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete';
  plan: {
    name: string;
    price: number;
    interval: string;
    features: string[];
  };
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trialEnd: string | null;
}

interface PaymentMethod {
  type: string;
  card: {
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
  };
}

interface Invoice {
  id: string;
  date: string;
  amount: number;
  status: string;
  pdfUrl: string | null;
}

export function BillingSettingsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const isFreePlan = (subscription?.plan?.price ?? null) === 0 || (subscription?.plan?.name || '').toLowerCase().includes('free');

  useEffect(() => {
    loadBillingData();
  }, []);

  const loadBillingData = async () => {
    try {
      const [subRes, paymentRes, invoicesRes] = await Promise.all([
        api.get('/billing/subscription'),
        api.get('/billing/payment-method'),
        api.get('/billing/invoices'),
      ]);

      setSubscription(subRes.data);
      setPaymentMethod(paymentRes.data);
      setInvoices(invoicesRes.data);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setActionLoading('portal');
    try {
      const res = await api.post('/billing/create-portal-session', {});
      if (res.data.url) {
        window.location.href = res.data.url;
      }
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert(error.response?.data?.message || 'Billing portal is not available for this account.');
      } else
      if (error.response?.status === 503) {
        alert('Billing portal will be available once Stripe is configured. Contact support for billing inquiries.');
      } else {
        alert('Failed to open billing portal. Please try again.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddPaymentMethod = async () => {
    setActionLoading('setup');
    try {
      const res = await api.post('/billing/create-setup-session', {});
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        alert('Unable to start payment setup. Please try again.');
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        alert('Payment setup will be available once Stripe is configured. Contact support for help.');
      } else {
        alert(error.response?.data?.message || 'Failed to start payment setup. Please try again.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartSubscription = async () => {
    setActionLoading('checkout');
    try {
      const res = await api.post('/billing/create-checkout-session', {});
      if (res.data.url) {
        window.location.href = res.data.url;
      } else {
        alert('Unable to start checkout. Please try again.');
      }
    } catch (error: any) {
      if (error.response?.status === 503) {
        alert('Checkout will be available once Stripe is configured. Contact support for billing help.');
      } else {
        alert(error.response?.data?.message || 'Failed to start checkout. Please try again.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Are you sure you want to cancel your subscription? You\'ll continue to have access until the end of your billing period.')) {
      return;
    }

    setActionLoading('cancel');
    try {
      await api.post('/billing/cancel-subscription', { immediately: false });
      alert('Your subscription will be canceled at the end of your billing period.');
      loadBillingData();
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert(error.response?.data?.message || 'This subscription cannot be canceled from the app.');
      } else
      if (error.response?.status === 503) {
        alert('Subscription management will be available once Stripe is configured. Contact support for assistance.');
      } else {
        alert('Failed to cancel subscription. Please try again.');
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async () => {
    setActionLoading('reactivate');
    try {
      await api.post('/billing/reactivate-subscription', {});
      alert('Your subscription has been reactivated!');
      loadBillingData();
    } catch (error: any) {
      alert('Failed to reactivate subscription. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatAmount = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      active: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
      trialing: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
      past_due: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
      canceled: 'bg-red-500/20 text-red-300 border-red-400/30',
      incomplete: 'bg-slate-500/20 text-slate-300 border-slate-400/30',
    };
    const labels: Record<string, string> = {
      active: 'Active',
      trialing: 'Trial',
      past_due: 'Past Due',
      canceled: 'Canceled',
      incomplete: 'Incomplete',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${styles[status] || styles.incomplete}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getCardBrandIcon = (brand: string) => {
    const brands: Record<string, string> = {
      visa: '💳 Visa',
      mastercard: '💳 Mastercard',
      amex: '💳 Amex',
      discover: '💳 Discover',
    };
    return brands[brand.toLowerCase()] || '💳 Card';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Your Plan */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">Your plan</h2>
        <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
          Manage your subscription and payment methods
        </p>

        <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-cyan-500/5 dark:to-blue-500/5 p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {subscription?.plan.name || 'AgentEasePro'}
                </h3>
                {subscription && getStatusBadge(subscription.status)}
                {subscription?.cancelAtPeriodEnd && (
                  <span className="inline-flex items-center rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-300 border border-amber-400/30">
                    Cancels soon
                  </span>
                )}
              </div>
              <p className="text-4xl font-bold text-cyan-600 dark:text-cyan-400 mb-1">
                ${subscription?.plan.price ?? 49.99}
                <span className="text-lg font-normal text-slate-500 dark:text-slate-300">/{subscription?.plan.interval ?? 'month'}</span>
              </p>
              {subscription && (
                <p className="text-sm text-slate-500 dark:text-slate-300">
                  {subscription.cancelAtPeriodEnd 
                    ? `Access until ${formatDate(subscription.currentPeriodEnd)}`
                    : `Renews ${formatDate(subscription.currentPeriodEnd)}`
                  }
                </p>
              )}
              {subscription?.status === 'trialing' && subscription.trialEnd && (
                <p className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                  Full access trial ends {formatDate(subscription.trialEnd)}. Card on file is charged then, and renews every 30 days.
                </p>
              )}
            </div>
            <div className="hidden sm:block">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
            {(subscription?.plan.features || [
              'Unlimited deals and clients',
              'AI-powered task generation',
              'Priority Action Center',
              'E-signature & REPC automation',
              'Multi-channel marketing blasts',
              'Calendar & task sync',
              'MLS/IDX integration',
              'Lead capture landing pages',
              'Win the Day goal tracking',
              'Referral network CRM',
              'Email & SMS notifications',
              'Data export & backup',
            ]).map((feature, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <svg className="w-4 h-4 text-cyan-500 dark:text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            {subscription?.status !== 'active' && subscription?.status !== 'trialing' && !isFreePlan && (
              <button
                onClick={handleStartSubscription}
                disabled={actionLoading === 'checkout'}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors flex items-center gap-2"
              >
                {actionLoading === 'checkout' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12m6-6H6" />
                  </svg>
                )}
                Start 7-day trial
              </button>
            )}
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal' || isFreePlan}
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-5 py-2.5 text-sm font-medium text-white transition-colors flex items-center gap-2"
            >
              {actionLoading === 'portal' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              Manage billing
            </button>
            {subscription?.cancelAtPeriodEnd && (
              <button
                onClick={handleReactivate}
                disabled={actionLoading === 'reactivate'}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-5 py-2.5 text-sm font-medium text-white transition-colors"
              >
                {actionLoading === 'reactivate' ? 'Reactivating...' : 'Reactivate subscription'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">Payment method</h2>
        <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
          Your card on file for automatic payments
        </p>

        {paymentMethod ? (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-16 rounded-lg bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border border-slate-300 dark:border-white/10">
                <span className="text-lg">💳</span>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-50 flex items-center gap-2">
                  {getCardBrandIcon(paymentMethod.card.brand)}
                  <span className="text-slate-500 dark:text-slate-300">ending in</span>
                  {paymentMethod.card.last4}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-300">
                  Expires {paymentMethod.card.expMonth}/{paymentMethod.card.expYear}
                </p>
              </div>
            </div>
            <button
              onClick={handleManageBilling}
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-medium transition-colors"
            >
              Update
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 p-6 text-center">
            <svg className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-300 mb-3">No payment method on file</p>
            <button
              onClick={handleAddPaymentMethod}
              disabled={actionLoading === 'setup'}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed px-4 py-2 text-sm font-medium text-white transition-colors"
            >
              {actionLoading === 'setup' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              )}
              Add payment method
            </button>
          </div>
        )}

        {/* Secure payment note */}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Payments are securely processed by Stripe. We never store your card details.</span>
        </div>
      </div>

      {/* Billing History */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">Billing history</h2>
        <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
          Download past invoices and receipts
        </p>

        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                    <svg className="w-5 h-5 text-slate-500 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{formatDate(invoice.date)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">
                      {formatAmount(invoice.amount)} • 
                      <span className={invoice.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                        {' '}{invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                      </span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (invoice.pdfUrl) {
                      window.open(invoice.pdfUrl, '_blank');
                    } else {
                      alert('Invoice download will be available once Stripe is configured.');
                    }
                  }}
                  className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-medium flex items-center gap-1.5 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 dark:border-white/20 bg-slate-50 dark:bg-white/5 p-6 text-center">
            <svg className="w-10 h-10 mx-auto text-slate-400 dark:text-slate-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-slate-500 dark:text-slate-300">No invoices yet</p>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50 mb-1">Your usage</h2>
        <p className="text-xs text-slate-500 dark:text-slate-300 mb-6">
          See how much value you're getting from AgentEasePro
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Deals', value: '∞', sublabel: 'Unlimited' },
            { label: 'Clients', value: '∞', sublabel: 'Unlimited' },
            { label: 'Marketing Blasts', value: '∞', sublabel: 'Unlimited' },
            { label: 'AI Suggestions', value: '∞', sublabel: 'Unlimited' },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4 text-center">
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stat.value}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{stat.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.sublabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Subscription */}
      {subscription?.status === 'active' && !subscription.cancelAtPeriodEnd && (
        <div className="rounded-2xl border border-red-200 dark:border-red-400/20 bg-red-50 dark:bg-gradient-to-br dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">Cancel subscription</h3>
          <p className="text-xs text-slate-500 dark:text-slate-300 mb-4">
            Your access will continue until {formatDate(subscription.currentPeriodEnd)}. You can reactivate anytime.
          </p>
          <button
            onClick={handleCancelSubscription}
            disabled={actionLoading === 'cancel'}
            className="text-sm text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 font-medium disabled:opacity-50 transition-colors"
          >
            {actionLoading === 'cancel' ? 'Canceling...' : 'Cancel my subscription'}
          </button>
        </div>
      )}

      {/* Help */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-[#030b1a]/70 dark:via-[#041128]/60 dark:to-[#010712]/70 dark:backdrop-blur-xl p-6 shadow-sm dark:shadow-[0_25px_80px_rgba(1,8,20,0.65)]">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-full bg-cyan-100 dark:bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-cyan-600 dark:text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50 mb-1">Need help with billing?</h3>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-3">
              Have questions about your subscription or need to make changes? We're here to help.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-300 mb-3">
              Cancel anytime. If canceled, access stays active through the end of your current paid period.
            </p>
            <a
              href="mailto:support@agenteasepro.com"
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 dark:hover:text-cyan-300 font-medium"
            >
              Contact support →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
