import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-gradient-radial from-slate-500/15 via-slate-400/10 to-transparent blur-3xl"></div>
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-gradient-radial from-amber-500/20 via-[#f4b860]/10 to-transparent blur-3xl"></div>
      </div>

      {/* Navigation */}
      <header className="fixed top-0 left-0 right-0 z-50 py-3 backdrop-blur-xl bg-slate-950/30">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link to="/" aria-label="AgentEasePro home">
              <Logo size="md" showText={true} animated={false} />
            </Link>
            <Link
              to="/"
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </nav>
      </header>

      {/* Content */}
      <main className="relative pt-32 pb-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="glass-card rounded-3xl p-8 md:p-12">
            <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
            <p className="text-slate-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <div className="prose prose-invert prose-slate max-w-none">
              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">1. Introduction</h2>
                <p className="text-slate-300 leading-relaxed">
                  AgentEasePro ("we," "our," or "us") is committed to protecting the privacy of our users. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our real estate CRM platform and related services (the "Service"). Please read this privacy policy carefully. By using the Service, you agree to the collection and use of information in accordance with this policy.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">2. Information We Collect</h2>
                
                <h3 className="text-xl font-medium text-white mb-3">2.1 Personal Information</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We may collect personally identifiable information that you voluntarily provide, including but not limited to:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li>Name, email address, and phone number</li>
                  <li>Real estate license information</li>
                  <li>Business name and brokerage information</li>
                  <li>Billing and payment information</li>
                  <li>Profile photos and professional headshots</li>
                </ul>

                <h3 className="text-xl font-medium text-white mb-3">2.2 Client and Transaction Data</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  When you use our Service to manage your real estate business, we collect:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li>Client contact information and communication history</li>
                  <li>Property listing details and transaction records</li>
                  <li>Contract and document information (including REPCs, addenda, and amendments)</li>
                  <li>Task and deadline tracking data</li>
                  <li>Lead capture form submissions</li>
                </ul>

                <h3 className="text-xl font-medium text-white mb-3">2.3 Calendar and Integration Data</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  When you connect third-party services, we may access:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li>Google Calendar events and scheduling data</li>
                  <li>Social media profile information (Facebook, Instagram, LinkedIn)</li>
                  <li>Email integration data for communication tracking</li>
                </ul>

                <h3 className="text-xl font-medium text-white mb-3">2.4 Automatically Collected Information</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We automatically collect certain information when you access the Service:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>IP address and device information</li>
                  <li>Browser type and operating system</li>
                  <li>Usage patterns and feature interactions</li>
                  <li>Cookies and similar tracking technologies</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">3. How We Use Your Information</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We use the collected information for the following purposes:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>To provide and maintain our Service</li>
                  <li>To manage your account and provide customer support</li>
                  <li>To facilitate contract creation, e-signatures, and document management</li>
                  <li>To sync calendar events and manage deadlines</li>
                  <li>To process lead capture forms and client inquiries</li>
                  <li>To generate marketing materials and QR codes</li>
                  <li>To send transactional emails and notifications</li>
                  <li>To analyze usage patterns and improve our Service</li>
                  <li>To comply with legal obligations</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">4. Third-Party Integrations</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Our Service integrates with third-party platforms. When you authorize these integrations:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li><strong className="text-white">Google Calendar:</strong> We access your calendar to sync events, deadlines, and appointments. We only read and write events relevant to your real estate transactions.</li>
                  <li><strong className="text-white">Social Media Platforms:</strong> When connected, we may post marketing content on your behalf and access basic profile information.</li>
                  <li><strong className="text-white">Payment Processors:</strong> We use secure third-party payment processors to handle billing. We do not store complete credit card information.</li>
                </ul>
                <p className="text-slate-300 leading-relaxed">
                  Each integration is subject to the respective platform's privacy policy. You can disconnect integrations at any time from your account settings.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">5. Data Security</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We implement industry-standard security measures to protect your data:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>All data is encrypted in transit using TLS/SSL</li>
                  <li>Sensitive data is encrypted at rest using AES-256 encryption</li>
                  <li>OAuth tokens are stored securely with encryption</li>
                  <li>Regular security audits and vulnerability assessments</li>
                  <li>Access controls and authentication requirements</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">6. Data Sharing and Disclosure</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We do not sell your personal information. We may share your information in the following circumstances:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li><strong className="text-white">With Your Consent:</strong> When you authorize specific sharing or integrations</li>
                  <li><strong className="text-white">Service Providers:</strong> With trusted vendors who assist in operating our Service (hosting, analytics, support)</li>
                  <li><strong className="text-white">Legal Compliance:</strong> When required by law, subpoena, or legal process</li>
                  <li><strong className="text-white">Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
                  <li><strong className="text-white">E-Signature Parties:</strong> Document information is shared with designated signers</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">7. Cookies and Tracking</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  We use cookies and similar technologies to:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li>Maintain your session and authentication state</li>
                  <li>Remember your preferences and settings</li>
                  <li>Analyze usage patterns to improve our Service</li>
                  <li>Provide personalized features</li>
                </ul>
                <p className="text-slate-300 leading-relaxed">
                  You can control cookie settings through your browser preferences. Disabling cookies may limit certain features of the Service.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">8. Your Rights</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Depending on your location, you may have the following rights:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li><strong className="text-white">Access:</strong> Request a copy of your personal data</li>
                  <li><strong className="text-white">Correction:</strong> Request correction of inaccurate data</li>
                  <li><strong className="text-white">Deletion:</strong> Request deletion of your personal data</li>
                  <li><strong className="text-white">Portability:</strong> Request your data in a portable format</li>
                  <li><strong className="text-white">Opt-Out:</strong> Unsubscribe from marketing communications</li>
                  <li><strong className="text-white">Withdraw Consent:</strong> Revoke authorization for integrations</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">9. Data Retention</h2>
                <p className="text-slate-300 leading-relaxed">
                  We retain your information for as long as your account is active or as needed to provide you with the Service. Transaction records and contracts may be retained longer to comply with legal requirements and business needs. You may request deletion of your account and associated data by contacting us.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">10. Children's Privacy</h2>
                <p className="text-slate-300 leading-relaxed">
                  Our Service is not intended for use by children under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">11. Changes to This Policy</h2>
                <p className="text-slate-300 leading-relaxed">
                  We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">12. Contact Us</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  If you have questions about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                  <p className="text-white font-semibold mb-2">AgentEasePro</p>
                  <p className="text-slate-300">Email: <a href="mailto:privacy@agenteasepro.com" className="text-[#f4b860] hover:underline">privacy@agenteasepro.com</a></p>
                  <p className="text-slate-300">Website: <a href="https://agenteasepro.com" className="text-[#f4b860] hover:underline">agenteasepro.com</a></p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative py-8 border-t border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} AgentEasePro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
