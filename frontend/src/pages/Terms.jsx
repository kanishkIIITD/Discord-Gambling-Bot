import { Navigation } from '../components/Navigation';
import { motion } from 'framer-motion';

export const Terms = () => {
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
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight font-display">Terms of Service</h1>
          
          <div className="prose prose-invert max-w-none text-sm sm:text-base">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">1. Acceptance of Terms</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              By accessing and using the Gambling Bot service, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">2. Service Description</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              Gambling Bot is a Discord bot that provides virtual gambling services for entertainment purposes. All currency used is virtual and has no real-world value.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">3. User Eligibility</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              To use our service, you must:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Be at least 18 years old</li>
              <li>Have a valid Discord account</li>
              <li>Comply with Discord's Terms of Service</li>
              <li>Not be prohibited from using gambling services in your jurisdiction</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">4. User Conduct</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              Users must not:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Use multiple accounts to gain unfair advantages</li>
              <li>Attempt to manipulate or exploit the system</li>
              <li>Use automated scripts or bots</li>
              <li>Engage in any form of harassment or abuse</li>
              <li>Attempt to sell or trade virtual currency</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">5. Virtual Currency</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              Our service uses virtual currency that:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Has no real-world monetary value</li>
              <li>Cannot be exchanged for real money</li>
              <li>Cannot be transferred between users</li>
              <li>Can be modified or reset at our discretion</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">6. Modifications to Service</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              We reserve the right to:
            </p>
            <ul className="list-disc pl-6 text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              <li>Modify or discontinue any part of the service</li>
              <li>Change virtual currency values or rates</li>
              <li>Update these terms at any time</li>
              <li>Ban users who violate these terms</li>
            </ul>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">7. Disclaimer</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              The service is provided "as is" without any warranties. We are not responsible for any losses or damages arising from the use of our service.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">8. Contact</h2>
            <p className="text-text-secondary leading-relaxed tracking-wide font-base">
              For questions about these terms, contact us at:<br />
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