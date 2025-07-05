import { Link } from 'react-router-dom';
import { Navigation } from '../components/Navigation';
import { motion } from 'framer-motion';
import OptimizedImage from '../components/OptimizedImage';
import { useUserStore } from '../store';

const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.6,
      ease: 'easeOut',
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

export const Login = () => {
  const login = useUserStore(state => state.login);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <div className="w-full max-w-md">
            <motion.div
              className="bg-card rounded-lg shadow p-8 space-y-8"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.div className="text-center space-y-2" variants={itemVariants}>
                <motion.h1
                  className="text-4xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent tracking-tight font-display"
                  animate={{ scale: [1, 1.03, 1] }}
                  transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
                >
                  Gambling Bot
                </motion.h1>
                <p className="text-text-secondary leading-relaxed tracking-wide font-accent">
                  Your ultimate Discord gambling companion
                </p>
              </motion.div>

              <motion.div className="space-y-6" variants={itemVariants}>
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-card text-text-secondary tracking-wide font-base">
                      Sign in to continue
                    </span>
                  </div>
                </div>

                <motion.button
                  onClick={login}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-transform font-base"
                >
                  <OptimizedImage 
                    src="/discord-logo.svg" 
                    alt="Discord" 
                    width={24} 
                    height={24} 
                    className="mr-2" 
                    ariaLabel="Discord logo"
                  />
                  <span>Continue with Discord</span>
                </motion.button>


                <motion.div className="text-center space-y-4" variants={itemVariants}>
                  <p className="text-sm text-text-secondary leading-relaxed tracking-wide font-base">
                    By continuing, you agree to our{' '}
                    <Link to="/terms" className="text-primary hover:underline">
                      Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link to="/privacy" className="text-primary hover:underline">
                      Privacy Policy
                    </Link>
                  </p>
                  <p className="text-xs text-text-secondary tracking-wide font-base">
                    Must be 18+ to use this service
                  </p>
                </motion.div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  );
};
