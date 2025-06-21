import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from '../components/Navigation';

const PolicyModal = ({ open, onClose, title, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-card rounded-2xl shadow-xl max-w-lg w-full p-8 relative border border-border">
        <button
          className="absolute top-4 right-4 text-2xl text-text-secondary hover:text-error transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          &times;
        </button>
        <h2 className="text-2xl font-bold mb-4 text-text-primary">{title}</h2>
        <div className="text-text-secondary text-base leading-relaxed">{children}</div>
      </div>
    </div>
  );
};

export const Landing = () => {
  const [modal, setModal] = useState(null);
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-16">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4 md:mb-6 tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Gambling Bot</span>
          </h1>
          <p className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed tracking-wide px-4">
            The ultimate Discord bot for GTA RP gambling. Create bets, manage your points, and enjoy the thrill of virtual gambling with your community.
          </p>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-16">
          <div className="bg-card p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide">Easy Betting</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base">
              Create and manage bets with simple Discord commands. Perfect for GTA RP events and competitions.
            </p>
          </div>
          <div className="bg-card p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide">Point System</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base">
              Earn and spend points through various activities. Keep track of your balance with our intuitive dashboard.
            </p>
          </div>
          <div className="bg-card p-4 md:p-6 rounded-lg shadow-lg">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide">Community Focus</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base">
              Built for GTA RP communities. Foster engagement and excitement through virtual gambling activities.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4 md:mb-6 tracking-tight">Ready to Get Started?</h2>
          <p className="text-base md:text-lg text-text-secondary mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed tracking-wide px-4">
            Join thousands of GTA RP players who are already using Gambling Bot to enhance their server experience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center px-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-colors"
            >
              Login with Discord
            </Link>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=1101659326464&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-primary text-base font-medium rounded-md text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-colors"
            >
              Add to Discord
            </a>
            <a
              href="https://discord.com/users/294497956348821505"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-secondary text-base font-medium rounded-md text-secondary hover:bg-secondary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary tracking-wide transition-colors"
            >
              Contact on Discord
            </a>
          </div>
        </div>
      </main>

      {/* Policy Modals */}
      <PolicyModal open={modal === 'cookie'} onClose={() => setModal(null)} title="Cookie Policy">
        We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. By using this site, you consent to our use of cookies. You can manage your cookie preferences in your browser settings.
      </PolicyModal>
      <PolicyModal open={modal === 'acceptable'} onClose={() => setModal(null)} title="Acceptable Use Policy">
        You agree to use Gambling Bot responsibly and not to engage in any activity that is illegal, abusive, or disruptive to others. Any misuse of the bot or platform may result in suspension or ban.
      </PolicyModal>
      <PolicyModal open={modal === 'security'} onClose={() => setModal(null)} title="Security">
        We take security seriously. Your data is protected using industry-standard measures. Please report any vulnerabilities or suspicious activity to our support team immediately.
      </PolicyModal>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-8 md:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12 lg:gap-60">
            {/* Brand Section */}
            <div className="w-full">
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight mb-4">
                Gambling Bot
              </h2>
              <p className="text-text-secondary leading-relaxed tracking-wide mb-6 max-w-md text-sm md:text-base">
                The ultimate Discord bot for GTA RP gambling. Create bets, manage your points, and enjoy the thrill of virtual gambling with your community.
              </p>
            </div>

            {/* Quick Links */}
            <div className="w-full">
              <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Quick Links</h3>
              <ul className="space-y-2 md:space-y-3">
                <li>
                  <Link to="/dashboard" className="text-text-secondary hover:text-primary transition-colors tracking-wide text-sm md:text-base">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/bot-permissions" className="text-text-secondary hover:text-primary transition-colors tracking-wide text-sm md:text-base">
                    Bot Permissions
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-text-secondary hover:text-primary transition-colors tracking-wide text-sm md:text-base">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-text-secondary hover:text-primary transition-colors tracking-wide text-sm md:text-base">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div className="w-full">
              <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Support</h3>
              <ul className="space-y-2 md:space-y-3">
                <li>
                  <a href="https://discord.com/users/294497956348821505" className="text-text-secondary hover:text-primary transition-colors tracking-wide text-sm md:text-base" target="_blank" rel="noopener noreferrer">
                    Contact Support
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-8 md:mt-12 pt-6 md:pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-text-secondary tracking-wide text-sm md:text-base text-center md:text-left">
                © {new Date().getFullYear()} Gambling Bot. All rights reserved.
              </p>
              <div className="flex flex-wrap justify-center md:justify-end gap-4 md:gap-6">
                <button onClick={() => setModal('cookie')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer text-sm md:text-base">Cookie Policy</button>
                <button onClick={() => setModal('acceptable')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer text-sm md:text-base">Acceptable Use</button>
                <button onClick={() => setModal('security')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer text-sm md:text-base">Security</button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}; 