import React, { useEffect, useState } from 'react';
import { getDiscordCommands } from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import LoadingSpinner from '../components/LoadingSpinner';

export const Help = () => {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const fetchCommands = async () => {
      try {
        setLoading(true);
        const data = await getDiscordCommands();
        setCommands(data);
      } catch (err) {
        console.error('Error fetching Discord commands:', err);
        setError('Failed to load commands.');
      } finally {
        setLoading(false);
      }
    };

    fetchCommands();
  }, []);

  const categories = ['All', ...Array.from(new Set(commands.map(cmd => cmd.category).filter(Boolean)))];
  const filteredCommands = category === 'All' ? commands : commands.filter(cmd => cmd.category === category);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" color="primary" message="Loading commands..." />
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full"
    >
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center font-display">Discord Commands</h1>

      <div className="mb-6 flex flex-wrap gap-2 justify-center">
        {categories.map(cat => (
          <motion.button
            key={cat}
            className={`px-4 py-2 rounded-md font-medium border transition-colors font-base ${
              category === cat
                ? 'bg-primary text-white border-primary'
                : 'bg-background text-text-secondary border-border hover:bg-primary/10'
            }`}
            onClick={() => setCategory(cat)}
            whileHover={{
              scale: 1.05,
              boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
              y: -2
            }}
            whileTap={{ scale: 0.95 }}
            transition={{
              type: 'spring',
              stiffness: 400,
              damping: 10
            }}
          >
            {cat}
          </motion.button>
        ))}
      </div>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={category}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            {filteredCommands.length > 0 ? (
              <div className="space-y-6">
                {filteredCommands.map((command, index) => (
                  <div key={index} className="pb-4 border-b border-border last:border-b-0">
                    <h3 className="text-xl font-semibold text-text-primary mb-2 tracking-wide font-mono">/{command.name}</h3>
                    <p className="text-text-secondary leading-relaxed tracking-wide font-base">{command.description}</p>
                    {command.options && command.options.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-md font-medium text-text-secondary mb-1 font-heading">Options:</h4>
                        <ul className="list-disc list-inside text-text-secondary leading-relaxed tracking-wide font-base">
                          {command.options.map((option, optIndex) => (
                            <li key={optIndex}>
                              <code className="font-mono">{option.name}</code>: {option.description} {option.required && '(Required)'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-text-secondary leading-relaxed tracking-wide text-center font-base">No commands found.</p>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};