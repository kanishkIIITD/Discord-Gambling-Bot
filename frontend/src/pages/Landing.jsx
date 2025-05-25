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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-text-primary mb-6 tracking-tight">
            Welcome to <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Gambling Bot</span>
          </h1>
          <p className="text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed tracking-wide">
            The ultimate Discord bot for GTA RP gambling. Create bets, manage your points, and enjoy the thrill of virtual gambling with your community.
          </p>
        </div>

        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide">Easy Betting</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide">
              Create and manage bets with simple Discord commands. Perfect for GTA RP events and competitions.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide">Point System</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide">
              Earn and spend points through various activities. Keep track of your balance with our intuitive dashboard.
            </p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-semibold text-text-primary mb-4 tracking-wide">Community Focus</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide">
              Built for GTA RP communities. Foster engagement and excitement through virtual gambling activities.
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-text-primary mb-6 tracking-tight">Ready to Get Started?</h2>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto leading-relaxed tracking-wide">
            Join thousands of GTA RP players who are already using Gambling Bot to enhance their server experience.
          </p>
          <div className="space-x-4">
            <Link
              to="/login"
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide"
            >
              Login with Discord
            </Link>
            <a
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=2147503104&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-3 border border-primary text-base font-medium rounded-md text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide"
            >
              Add to Discord
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
      <footer className="bg-card border-t border-border mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex justify-evenly ">
            {/* Brand Section */}
            <div className="col-span-1 md:col-span-2">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight mb-4">
                Gambling Bot
              </h2>
              <p className="text-text-secondary leading-relaxed tracking-wide mb-6 max-w-md">
                The ultimate Discord bot for GTA RP gambling. Create bets, manage your points, and enjoy the thrill of virtual gambling with your community.
              </p>
              {/* <div className="flex space-x-4">
                <a href="https://discord.gg/your-server" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </a>
                <a href="https://twitter.com/your-handle" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
                  </svg>
                </a>
                <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
                  </svg>
                </a>
              </div> */}
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Quick Links</h3>
              <ul className="space-y-3">
                <li>
                  <Link to="/dashboard" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link to="/bot-permissions" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Bot Permissions
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link to="/privacy" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Support */}
            {/* TODO: Update these links */}
            {/* <div>
              <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Support</h3>
              <ul className="space-y-3">
                <li>
                  <a href="https://discord.gg/your-server" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Join Discord
                  </a>
                </li>
                <li>
                  <a href="mailto:support@gamblingbot.com" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Contact Support
                  </a>
                </li>
                <li>
                  <a href="https://docs.gamblingbot.com" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://status.gamblingbot.com" target="_blank" rel="noopener noreferrer" className="text-text-secondary hover:text-primary transition-colors tracking-wide">
                    System Status
                  </a>
                </li>
              </ul>
            </div> */}
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-border">
            <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
              <p className="text-text-secondary tracking-wide">
                © {new Date().getFullYear()} Gambling Bot. All rights reserved.
              </p>
              <div className="flex space-x-6">
                <button onClick={() => setModal('cookie')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer">Cookie Policy</button>
                <button onClick={() => setModal('acceptable')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer">Acceptable Use</button>
                <button onClick={() => setModal('security')} className="text-text-secondary hover:text-primary transition-colors tracking-wide bg-transparent border-none p-0 m-0 cursor-pointer">Security</button>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}; 