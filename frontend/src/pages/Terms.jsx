import { Navigation } from '../components/Navigation';

export const Terms = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">1. Acceptance of Terms</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              By accessing and using the Gambling Bot service, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">2. Service Description</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              Gambling Bot is a Discord bot that provides virtual gambling services for entertainment purposes. All currency used is virtual and has no real-world value.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">3. User Eligibility</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              To use our service, you must:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Be at least 18 years old</li>
              <li>Have a valid Discord account</li>
              <li>Comply with Discord's Terms of Service</li>
              <li>Not be prohibited from using gambling services in your jurisdiction</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">4. User Conduct</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              Users must not:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Use multiple accounts to gain unfair advantages</li>
              <li>Attempt to manipulate or exploit the system</li>
              <li>Use automated scripts or bots</li>
              <li>Engage in any form of harassment or abuse</li>
              <li>Attempt to sell or trade virtual currency</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">5. Virtual Currency</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              Our service uses virtual currency that:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Has no real-world monetary value</li>
              <li>Cannot be exchanged for real money</li>
              <li>Cannot be transferred between users</li>
              <li>Can be modified or reset at our discretion</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">6. Modifications to Service</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              We reserve the right to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Modify or discontinue any part of the service</li>
              <li>Change virtual currency values or rates</li>
              <li>Update these terms at any time</li>
              <li>Ban users who violate these terms</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">7. Disclaimer</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              The service is provided "as is" without any warranties. We are not responsible for any losses or damages arising from the use of our service.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">8. Contact</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide">
              For questions about these terms, contact us at:<br />
              {/* Email: support@gamblingbot.com<br />
              Discord: Join our support server */}
              Discord Username: lostman
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}; 