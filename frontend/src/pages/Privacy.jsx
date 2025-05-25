import { Navigation } from '../components/Navigation';

export const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">1. Information We Collect</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Discord user information (username, ID, avatar)</li>
              <li>Server information where the bot is installed</li>
              <li>Betting activity and transaction history</li>
              <li>Communication preferences</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">2. How We Use Your Information</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Provide and maintain our services</li>
              <li>Process your bets and transactions</li>
              <li>Send you important updates and notifications</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">3. Information Sharing</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              We do not sell or rent your personal information to third parties. We may share your information with:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Service providers who assist in operating our services</li>
              <li>Law enforcement when required by law</li>
              <li>Other users in your Discord server (for betting activities)</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">4. Data Security</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">5. Your Rights</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt-out of certain data collection</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">6. Contact Us</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-text-secondary leading-relaxed tracking-wide">
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