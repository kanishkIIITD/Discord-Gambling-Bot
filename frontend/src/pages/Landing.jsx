import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import SplitTextComponent from '../components/SplitTextComponent';
import { motion } from 'framer-motion';
import RadixDialog from '../components/RadixDialog';
import PageTransition from '../components/PageTransition';
import AnimatedElement from '../components/AnimatedElement';
import { useAnimation } from '../contexts/AnimationContext';

// Using RadixDialog instead of custom PolicyModal

export const Landing = () => {
  const [modal, setModal] = useState(null);
  const { getVariants } = useAnimation();
  
  return (
    <PageTransition className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {/* Hero Section */}
        <div className="text-center mb-8 md:mb-16">
          <motion.h1
            initial={{ y: 12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-text-primary mb-4 md:mb-6 tracking-tight font-display"
          >
            Welcome to{" "}
            <motion.span
              initial={{ backgroundPosition: "0% 50%" }}
              animate={{ backgroundPosition: "200% 50%" }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="bg-gradient-to-r from-primary via-text-secondary to-secondary bg-[length:200%_200%] bg-clip-text text-transparent inline-block"
            >
              Gambling Bot
            </motion.span>
          </motion.h1>
          <SplitTextComponent
            text="The ultimate Discord bot for GTA RP gambling. Create bets, manage your points, and enjoy the thrill of virtual gambling with your community."
            className="text-lg sm:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed tracking-wide px-4 font-accent"
          />
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8 mb-8 md:mb-16 stagger-container">
          <AnimatedElement variant="FADE_IN_UP" delay={0.1} className="bg-card p-4 md:p-6 rounded-lg shadow-lg floating">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide font-heading">Easy Betting</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base font-base">
              Create and manage bets with simple Discord commands. Perfect for GTA RP events and competitions.
            </p>
          </AnimatedElement>
          <AnimatedElement variant="FADE_IN_UP" delay={0.2} className="bg-card p-4 md:p-6 rounded-lg shadow-lg floating">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide font-heading">Point System</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base font-base">
              Earn and spend points through various activities. Keep track of your balance with our intuitive dashboard.
            </p>
          </AnimatedElement>
          <AnimatedElement variant="FADE_IN_UP" delay={0.3} className="bg-card p-4 md:p-6 rounded-lg shadow-lg floating">
            <h3 className="text-lg md:text-xl font-semibold text-text-primary mb-3 md:mb-4 tracking-wide font-heading">Community Focus</h3>
            <p className="text-text-secondary leading-relaxed tracking-wide text-sm md:text-base font-base">
              Built for GTA RP communities. Foster engagement and excitement through virtual gambling activities.
            </p>
          </AnimatedElement>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <motion.h2
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="text-2xl sm:text-3xl font-bold text-text-primary mb-4 md:mb-6 tracking-tight font-display"
          >
            Ready to Get Started?
          </motion.h2>
          <motion.p
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="text-base md:text-lg text-text-secondary mb-6 md:mb-8 max-w-2xl mx-auto leading-relaxed tracking-wide px-4 font-accent"
          >
            Join thousands of GTA RP players who are already using Gambling Bot to enhance their server experience.
          </motion.p>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-center px-4">
            <motion.button
              whileHover={{ scale: 1.05, rotate: -1, boxShadow: "0px 0px 12px rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.95 }}
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-colors font-base"
              onClick={() => window.location.href = "/login"}
            >
              Login with Discord
            </motion.button>

            <motion.a
              whileHover={{ scale: 1.05, boxShadow: "0px 0px 12px rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.95 }}
              href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=1101659326464&scope=bot%20applications.commands`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-primary text-base font-medium rounded-md text-primary hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-colors font-base"
            >
              Add to Discord
            </motion.a>

            <motion.a
              whileHover={{ scale: 1.05, rotate: 1, boxShadow: "0px 0px 12px rgba(255,255,255,0.3)" }}
              whileTap={{ scale: 0.95 }}
              href="https://discord.com/users/294497956348821505"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-secondary text-base font-medium rounded-md text-secondary hover:bg-secondary/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary tracking-wide transition-colors font-base"
            >
              Contact on Discord
            </motion.a>
          </div>
        </div>
      </main>

      {/* Policy Modals */}
      <RadixDialog
        open={modal === 'cookie'}
        onOpenChange={() => setModal(null)}
        title="Cookie Policy"
      >
        <div className="text-text-secondary text-base leading-relaxed font-base">
          We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. By using this site, you consent to our use of cookies. You can manage your cookie preferences in your browser settings.
        </div>
      </RadixDialog>
      
      <RadixDialog
        open={modal === 'acceptable'}
        onOpenChange={() => setModal(null)}
        title="Acceptable Use Policy"
      >
        <div className="text-text-secondary text-base leading-relaxed font-base">
          You agree to use Gambling Bot responsibly and not to engage in any activity that is illegal, abusive, or disruptive to others. Any misuse of the bot or platform may result in suspension or ban.
        </div>
      </RadixDialog>
      
      <RadixDialog
        open={modal === 'security'}
        onOpenChange={() => setModal(null)}
        title="Security"
      >
        <div className="text-text-secondary text-base leading-relaxed font-base">
          We take security seriously. Your data is protected using industry-standard measures. Please report any vulnerabilities or suspicious activity to our support team immediately.
        </div>
      </RadixDialog>

      {/* Footer */}
      <footer className="bg-card border-t border-border mt-8 md:mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
            <p className="text-text-secondary tracking-wide text-xs md:text-sm text-center md:text-left font-base">
              © {new Date().getFullYear()} <a href='https://discord-gambling-bot.vercel.app/' target='_blank' rel='noopener noreferrer' className='text-primary hover:text-primary/80 transition-colors hover:underline'>Nopixel Gambling Bot</a>. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-xs md:text-sm">
              <button onClick={() => setModal('cookie')} className="text-text-secondary hover:text-primary transition-colors bg-transparent border-none p-0 m-0 cursor-pointer hover:underline underline-offset-2 focus:outline-none font-base">
                Cookie Policy
              </button>
              <span className="text-border">|</span>
              <button onClick={() => setModal('acceptable')} className="text-text-secondary hover:text-primary transition-colors bg-transparent border-none p-0 m-0 cursor-pointer hover:underline underline-offset-2 focus:outline-none font-base">
                Acceptable Use
              </button>
              <span className="text-border">|</span>
              <button onClick={() => setModal('security')} className="text-text-secondary hover:text-primary transition-colors bg-transparent border-none p-0 m-0 cursor-pointer hover:underline underline-offset-2 focus:outline-none font-base">
                Security
              </button>
            </div>
          </div>
        </div>
      </footer>
    </PageTransition>
  );
};