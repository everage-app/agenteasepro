import { useEffect, useState } from 'react';
import { Check, CreditCard, Download, FileText, HelpCircle, LockKeyhole, Plus, Settings, Zap } from 'lucide-react';
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
      visa: 'Visa',
      mastercard: 'Mastercard',
      amex: 'Amex',
      discover: 'Discover',
    };
    return brands[brand.toLowerCase()] || 'Card';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
      </div>
    );
  }

  const billingCardClass = 'ae-theme-card rounded-3xl border border-slate-200/80 bg-white p-5 shadow-[0_20px_50px_-32px_rgba(15,23,42,0.42)] dark:border-[#f2d894]/[0.14] dark:bg-[#060b14]/95 dark:shadow-[0_24px_80px_rgba(0,0,0,0.48)] sm:p-6';
  const billingPanelClass = 'rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/[0.08] dark:bg-[#0b1220]/90';
  const primaryActionClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#1f9bd8] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(31,155,216,0.22)] transition-colors hover:bg-[#1689c4] disabled:cursor-not-allowed disabled:opacity-50';
  const goldActionClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#f2d894] via-[#d6b56d] to-[#b48a3a] px-4 py-2.5 text-sm font-semibold text-[#171106] shadow-[0_16px_36px_rgba(214,181,109,0.22)] transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60';

  return (
    <div className="space-y-5">
      {/* Your Plan */}
      <div className={billingCardClass}>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Your plan</h2>
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Manage your subscription and payment methods
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d6b56d]/35 bg-[#fff7df] px-3 py-1.5 text-xs font-bold text-[#7a5a24] dark:bg-[#d6b56d]/10 dark:text-[#f2d894]">
            <Zap className="h-3.5 w-3.5" strokeWidth={2.3} />
            Full platform access
          </div>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-[#d6b56d]/35 bg-gradient-to-br from-[#fff9e8] via-white to-[#eef7ff] p-5 dark:border-[#f2d894]/20 dark:from-[#111827] dark:via-[#0b1220] dark:to-[#07111d] sm:p-6">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#d6b56d]/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative">
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
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#f2d894] via-[#d6b56d] to-[#9f7933] shadow-lg shadow-[#d6b56d]/20">
                <Zap className="h-8 w-8 text-[#171106]" strokeWidth={2.4} />
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
              <div key={i} className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white/65 px-3 py-2 text-sm font-medium text-slate-700 dark:border-white/[0.07] dark:bg-white/[0.035] dark:text-slate-200">
                <Check className="h-4 w-4 flex-shrink-0 text-emerald-500 dark:text-emerald-300" strokeWidth={2.4} />
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
                className={primaryActionClass}
              >
                {actionLoading === 'checkout' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.4} />
                )}
                Start 7-day trial
              </button>
            )}
            <button
              onClick={handleManageBilling}
              disabled={actionLoading === 'portal' || isFreePlan}
              className={goldActionClass}
            >
              {actionLoading === 'portal' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Settings className="h-4 w-4" strokeWidth={2.4} />
              )}
              Manage billing
            </button>
            {subscription?.cancelAtPeriodEnd && (
              <button
                onClick={handleReactivate}
                disabled={actionLoading === 'reactivate'}
                className={primaryActionClass}
              >
                {actionLoading === 'reactivate' ? 'Reactivating...' : 'Reactivate subscription'}
              </button>
            )}
          </div>
          </div>
        </div>
      </div>

      {/* Payment Method */}
      <div className={billingCardClass}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Payment method</h2>
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Your card on file for automatic payments
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-400/25 bg-cyan-500/10 text-cyan-500 dark:text-cyan-200">
            <CreditCard className="h-5 w-5" strokeWidth={2.2} />
          </div>
        </div>

        {paymentMethod ? (
          <div className={`${billingPanelClass} flex items-center justify-between`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-16 items-center justify-center rounded-xl border border-slate-300 bg-gradient-to-br from-slate-200 to-slate-300 dark:border-white/10 dark:from-slate-700 dark:to-slate-900">
                <CreditCard className="h-5 w-5 text-slate-600 dark:text-slate-200" />
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
          <div className={`${billingPanelClass} border-dashed p-6 text-center`}>
            <CreditCard className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-slate-300" strokeWidth={1.7} />
            <p className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-200">No payment method on file</p>
            <button
              onClick={handleAddPaymentMethod}
              disabled={actionLoading === 'setup'}
              className={primaryActionClass}
            >
              {actionLoading === 'setup' ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Plus className="h-4 w-4" strokeWidth={2.4} />
              )}
              Add payment method
            </button>
          </div>
        )}

        {/* Secure payment note */}
        <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <LockKeyhole className="h-4 w-4" strokeWidth={2.2} />
          <span>Payments are securely processed by Stripe. We never store your card details.</span>
        </div>
      </div>

      {/* Billing History */}
      <div className={billingCardClass}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Billing history</h2>
            <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
              Download past invoices and receipts
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-[#d6b56d]/30 bg-[#d6b56d]/10 text-[#9f7933] dark:text-[#f2d894]">
            <FileText className="h-5 w-5" strokeWidth={2.2} />
          </div>
        </div>

        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((invoice) => (
              <div key={invoice.id} className={`${billingPanelClass} flex items-center justify-between transition-colors hover:bg-white dark:hover:bg-white/[0.06]`}>
                <div className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-200 dark:bg-slate-900">
                    <FileText className="h-5 w-5 text-slate-500 dark:text-slate-300" strokeWidth={2.2} />
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
                  className="flex items-center gap-1.5 text-sm font-semibold text-cyan-600 transition-colors hover:text-cyan-500 dark:text-cyan-300 dark:hover:text-cyan-200"
                >
                  <Download className="h-4 w-4" strokeWidth={2.3} />
                  Download
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className={`${billingPanelClass} border-dashed p-6 text-center`}>
            <FileText className="mx-auto mb-3 h-10 w-10 text-slate-400 dark:text-slate-300" strokeWidth={1.7} />
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-200">No invoices yet</p>
          </div>
        )}
      </div>

      {/* Usage Stats */}
      <div className={billingCardClass}>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Your usage</h2>
        <p className="mt-1 mb-5 text-xs font-medium text-slate-600 dark:text-slate-300">
          See how much value you're getting from AgentEasePro
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Active Deals', value: '∞', sublabel: 'Unlimited' },
            { label: 'Clients', value: '∞', sublabel: 'Unlimited' },
            { label: 'Marketing Blasts', value: '∞', sublabel: 'Unlimited' },
            { label: 'AI Suggestions', value: '∞', sublabel: 'Unlimited' },
          ].map((stat, i) => (
            <div key={i} className={`${billingPanelClass} text-center`}>
              <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{stat.value}</p>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{stat.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{stat.sublabel}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel Subscription */}
      {subscription?.status === 'active' && !subscription.cancelAtPeriodEnd && (
        <div className="ae-theme-card rounded-3xl border border-red-200 bg-red-50 p-5 shadow-sm dark:border-red-400/20 dark:bg-red-500/[0.06] sm:p-6">
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
      <div className={billingCardClass}>
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-300">
            <HelpCircle className="h-5 w-5" strokeWidth={2.2} />
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
