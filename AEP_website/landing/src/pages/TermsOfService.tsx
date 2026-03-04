import { Link } from 'react-router-dom';
import { Logo } from '../components/ui/Logo';

export function TermsOfService() {
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
            <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
            <p className="text-slate-400 mb-8">Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

            <div className="prose prose-invert prose-slate max-w-none">
              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">1. Acceptance of Terms</h2>
                <p className="text-slate-300 leading-relaxed">
                  Welcome to AgentEasePro. These Terms of Service ("Terms") govern your access to and use of the AgentEasePro platform, website, and services (collectively, the "Service"). By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, you may not use the Service.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">2. Description of Service</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  AgentEasePro is a comprehensive real estate CRM platform designed for Utah real estate agents. The Service includes:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Contract creation and management (REPCs, addenda, amendments)</li>
                  <li>Electronic signature capabilities</li>
                  <li>Client and lead management</li>
                  <li>Transaction and deal tracking</li>
                  <li>Calendar synchronization and deadline management</li>
                  <li>Marketing material generation</li>
                  <li>Listing management</li>
                  <li>Third-party integrations (Google, social media platforms)</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">3. Account Registration</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  To use the Service, you must create an account. You agree to:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Provide accurate, current, and complete information</li>
                  <li>Maintain and update your information to keep it accurate</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized access</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">4. Subscription and Payment</h2>
                
                <h3 className="text-xl font-medium text-white mb-3">4.1 Pricing</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  The Service is offered on a subscription basis. Current pricing is available on our website. We reserve the right to change pricing with 30 days' notice to existing subscribers.
                </p>

                <h3 className="text-xl font-medium text-white mb-3">4.2 Billing</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable except as expressly provided in these Terms.
                </p>

                <h3 className="text-xl font-medium text-white mb-3">4.3 Free Trial</h3>
                <p className="text-slate-300 leading-relaxed">
                  We may offer a free trial period. At the end of the trial, your account will be automatically converted to a paid subscription unless you cancel before the trial ends.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">5. Acceptable Use</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  You agree to use the Service only for lawful purposes and in accordance with these Terms. You agree NOT to:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Violate any applicable laws or regulations</li>
                  <li>Infringe upon the rights of others</li>
                  <li>Upload malicious code, viruses, or harmful content</li>
                  <li>Attempt to gain unauthorized access to the Service</li>
                  <li>Interfere with the proper functioning of the Service</li>
                  <li>Use the Service for any fraudulent or deceptive purposes</li>
                  <li>Resell, sublicense, or redistribute the Service without permission</li>
                  <li>Use automated systems to access the Service (bots, scrapers)</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">6. User Content and Data</h2>
                
                <h3 className="text-xl font-medium text-white mb-3">6.1 Your Content</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  You retain ownership of all content you upload to the Service, including client data, documents, and marketing materials. By uploading content, you grant us a limited license to store, process, and display your content as necessary to provide the Service.
                </p>

                <h3 className="text-xl font-medium text-white mb-3">6.2 Responsibility</h3>
                <p className="text-slate-300 leading-relaxed mb-4">
                  You are solely responsible for the accuracy and legality of all content you upload. You represent that you have the necessary rights to upload and use all content.
                </p>

                <h3 className="text-xl font-medium text-white mb-3">6.3 Data Backup</h3>
                <p className="text-slate-300 leading-relaxed">
                  While we maintain regular backups, you are responsible for maintaining your own copies of important data. We are not liable for any loss of data.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">7. Electronic Signatures</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  The Service includes electronic signature functionality. By using this feature:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>You acknowledge that electronic signatures are legally binding under applicable law (including ESIGN and UETA)</li>
                  <li>You agree to maintain accurate records of signed documents</li>
                  <li>You are responsible for ensuring all parties consent to electronic signing</li>
                  <li>We are not responsible for the legal validity of documents you create</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">8. Real Estate Compliance</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  AgentEasePro provides tools for real estate professionals but does not provide legal, financial, or professional advice. You are responsible for:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Complying with all applicable real estate laws and regulations</li>
                  <li>Maintaining your professional license and continuing education</li>
                  <li>Verifying the accuracy of all contracts and documents</li>
                  <li>Following your brokerage's policies and procedures</li>
                  <li>Consulting with legal professionals when necessary</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">9. Third-Party Integrations</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  The Service may integrate with third-party platforms (Google, Facebook, Instagram, LinkedIn). Your use of these integrations is subject to the respective platform's terms of service. We are not responsible for:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>The availability or functionality of third-party services</li>
                  <li>Changes to third-party APIs or policies</li>
                  <li>Actions taken by third-party platforms</li>
                  <li>Data handling by third-party services</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">10. Intellectual Property</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  The Service, including its design, features, code, and content (excluding user-uploaded content), is owned by AgentEasePro and protected by intellectual property laws. You may not:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Copy, modify, or create derivative works of the Service</li>
                  <li>Reverse engineer or attempt to extract source code</li>
                  <li>Remove or alter any proprietary notices</li>
                  <li>Use our trademarks without permission</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">11. Disclaimer of Warranties</h2>
                <p className="text-slate-300 leading-relaxed">
                  THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR SECURE.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">12. Limitation of Liability</h2>
                <p className="text-slate-300 leading-relaxed">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, AGENTEASEPRO SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOSS OF PROFITS, DATA, OR BUSINESS OPPORTUNITIES, ARISING OUT OF OR RELATED TO YOUR USE OF THE SERVICE. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE SERVICE IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">13. Indemnification</h2>
                <p className="text-slate-300 leading-relaxed">
                  You agree to indemnify, defend, and hold harmless AgentEasePro and its officers, directors, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorney fees) arising out of your use of the Service, your violation of these Terms, or your violation of any rights of another party.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">14. Termination</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  You may cancel your subscription at any time through your account settings. We may terminate or suspend your account at any time for:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2 mb-4">
                  <li>Violation of these Terms</li>
                  <li>Non-payment of fees</li>
                  <li>Fraudulent or illegal activity</li>
                  <li>Extended periods of inactivity</li>
                </ul>
                <p className="text-slate-300 leading-relaxed">
                  Upon termination, your access to the Service will cease. You may request an export of your data within 30 days of termination.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">15. Dispute Resolution</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  Any disputes arising from these Terms or the Service shall be resolved through:
                </p>
                <ul className="list-disc list-inside text-slate-300 space-y-2">
                  <li>Informal negotiation between the parties</li>
                  <li>Binding arbitration if negotiation fails</li>
                  <li>Venue shall be in Salt Lake County, Utah</li>
                </ul>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">16. Governing Law</h2>
                <p className="text-slate-300 leading-relaxed">
                  These Terms shall be governed by and construed in accordance with the laws of the State of Utah, without regard to its conflict of law provisions.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">17. Changes to Terms</h2>
                <p className="text-slate-300 leading-relaxed">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes by email or through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the new Terms.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">18. Severability</h2>
                <p className="text-slate-300 leading-relaxed">
                  If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">19. Entire Agreement</h2>
                <p className="text-slate-300 leading-relaxed">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and AgentEasePro regarding the Service and supersede all prior agreements.
                </p>
              </section>

              <section className="mb-10">
                <h2 className="text-2xl font-semibold text-white mb-4">20. Contact Information</h2>
                <p className="text-slate-300 leading-relaxed mb-4">
                  For questions about these Terms of Service, please contact us:
                </p>
                <div className="bg-slate-800/50 rounded-xl p-6 border border-white/10">
                  <p className="text-white font-semibold mb-2">AgentEasePro</p>
                  <p className="text-slate-300">Email: <a href="mailto:legal@agenteasepro.com" className="text-[#f4b860] hover:underline">legal@agenteasepro.com</a></p>
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
