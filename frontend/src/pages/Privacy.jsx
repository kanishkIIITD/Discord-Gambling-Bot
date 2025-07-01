import { Navigation } from '../components/Navigation';
import { motion } from 'framer-motion';

export const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full"
      >
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight font-display">Privacy Policy</h1>
          
          <div className="prose prose-invert max-w-none text-sm sm:text-base">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">1. Information We Collect</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Discord user information (username, ID, avatar)</li>
              <li>Server information where the bot is installed</li>
              <li>Betting activity and transaction history</li>
              <li>Communication preferences</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">2. How We Use Your Information</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Provide and maintain our services</li>
              <li>Process your bets and transactions</li>
              <li>Send you important updates and notifications</li>
              <li>Improve our services and user experience</li>
              <li>Comply with legal obligations</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">3. Information Sharing</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              We do not sell or rent your personal information to third parties. We may share your information with:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Service providers who assist in operating our services</li>
              <li>Law enforcement when required by law</li>
              <li>Other users in your Discord server (for betting activities)</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">4. Data Security</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">5. Your Rights</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Access your personal information</li>
              <li>Correct inaccurate information</li>
              <li>Request deletion of your information</li>
              <li>Opt-out of certain data collection</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">6. Contact Us</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-text-secondary leading-relaxed tracking-wide font-base">
              {/* Email: support@gamblingbot.com<br />
              Discord: Join our support server */}
              Discord Username: <a href='https://discord.com/users/294497956348821505' target='_blank' rel='noopener noreferrer' className='text-primary hover:text-primary/80 transition-colors hover:underline'>lostman</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}; 