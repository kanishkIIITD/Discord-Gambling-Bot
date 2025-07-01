import { Navigation } from '../components/Navigation';
import SupportButton from '../components/SupportButton';
import { FaCoffee } from 'react-icons/fa';
import { motion } from 'framer-motion';

export const Support = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full"
      >
        <div className="bg-card rounded-2xl shadow-xl p-6 sm:p-10 flex flex-col items-center">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-yellow-200 rounded-full p-4 mb-4 shadow-md">
              <FaCoffee className="text-yellow-700 text-4xl" />
            </div>
            <h1 className="text-3xl font-extrabold text-text-primary mb-2 tracking-tight text-center font-display">Support the Creator</h1>
            <p className="text-text-secondary text-center max-w-xl mb-2 font-accent">
              Hi! I'm the creator of this fun and interactive Discord bot, built from scratch with love (and a lot of caffeine ☕). I handle everything—from coding new features and fixing bugs to keeping the bot online 24/7 for your community.
            </p>
            <p className="text-text-secondary text-center max-w-xl mb-2 font-accent">
              If you enjoy using the bot and want to help support its development, hosting, and future features, consider buying me a coffee. Every little bit helps keep things running smoothly and brings more awesome updates!
            </p>
          </div>
          <motion.div 
            whileHover={{ scale: 1.05, boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)" }}
            whileTap={{ scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
            className="flex justify-center my-6"
          >
            <SupportButton />
          </motion.div>
          <div className="w-full bg-muted/50 rounded-lg p-5 mt-2">
            <h2 className="text-xl font-semibold text-text-primary mb-3 tracking-tight font-heading">What your support helps with:</h2>
            <ul className="list-disc pl-6 text-text-secondary space-y-2 font-base">
              <li>Server hosting to keep the bot alive 24/7</li>
              <li>Storage, database, and uptime costs</li>
              <li>Time spent developing and maintaining the bot</li>
              <li>Cool new features, updates, and events</li>
            </ul>
          </div>
          <p className="text-text-secondary text-center mt-8 mb-2 font-base">
            Thank you for your support, and for being part of the community! 💖
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Support; 