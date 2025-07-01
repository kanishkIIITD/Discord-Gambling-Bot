import React, { useState } from 'react';
import { Navigation } from './Navigation';
import { commandCategories } from '../data/commands';
import { motion, AnimatePresence } from 'framer-motion';

const HelpMenu = () => {
  const [selectedCategory, setSelectedCategory] = useState(commandCategories[0].name);
  const [expanded, setExpanded] = useState(null);

  const filteredCommands = commandCategories.find(cat => cat.name === selectedCategory).commands;

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
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight font-display">Command Reference</h1>
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {commandCategories.map(cat => (
              <motion.button
                key={cat.name}
                className={`px-4 py-2 rounded-md font-medium border transition-colors font-base ${
                  selectedCategory === cat.name ? 'bg-primary text-white border-primary' : 'bg-background text-text-primary border-text-secondary hover:bg-primary/10'
                }`}
                onClick={() => {
                  setSelectedCategory(cat.name);
                  setExpanded(null);
                }}
                aria-current={selectedCategory === cat.name ? 'page' : undefined}
                whileHover={{ 
                  scale: 1.05,
                  boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                  y: -2
                }}
                whileTap={{ scale: 0.95 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 10 
                }}
              >
                {cat.name}
              </motion.button>
            ))}
          </div>
          {/* Command List */}
          <div className="divide-y divide-gray-200">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={selectedCategory}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              >
                {filteredCommands.length === 0 && (
                  <div className="py-12 text-center text-text-secondary text-lg font-base">No commands found.</div>
                )}
                {filteredCommands.map(cmd => (
                  <div key={cmd.name} className="">
                    <button
                      className="w-full text-left py-4 px-3 flex items-center justify-between rounded-lg hover:bg-[#2A2D31] focus:bg-[#2A2D31] focus:outline-none transition group"
                      onClick={() => setExpanded(expanded === cmd.name ? null : cmd.name)}
                      aria-expanded={expanded === cmd.name}
                    >
                      <div className="flex flex-col flex-1 min-w-0">
                        <span className="font-mono font-semibold text-primary text-lg truncate font-mono">/{cmd.name}</span>
                        <span className="text-text-secondary text-sm truncate font-accent">{cmd.description}</span>
                      </div>
                      <span className="ml-4 text-primary text-xl group-hover:text-primary-dark transition">{expanded === cmd.name ? '▲' : '▼'}</span>
                    </button>
                    <AnimatePresence initial={false}>
                      {expanded === cmd.name && (
                        <motion.div
                          key={cmd.name}
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="bg-background border border-gray-200 rounded-lg shadow-inner p-5 mb-4">
                            <div className="mb-3">
                              <span className="block text-text-primary font-semibold mb-1 font-heading">Description</span>
                              <span className="block text-text-secondary text-base font-base">{cmd.description}</span>
                            </div>
                            <div className="mb-3">
                              <span className="block text-text-primary font-semibold mb-1 font-heading">Usage</span>
                              <code className="block bg-card rounded px-3 py-2 text-base text-primary whitespace-pre-wrap border border-gray-200 font-mono">{cmd.usage}</code>
                            </div>
                            {cmd.instructions && cmd.instructions.trim() && (
                              <div className="mb-3">
                                <span className="block text-text-primary font-semibold mb-1 font-heading">Instructions</span>
                                <span className="block text-text-secondary text-base font-base">{cmd.instructions}</span>
                              </div>
                            )}
                            {cmd.category && (
                              <div className="text-xs text-primary mt-2 font-base">Category: {cmd.category}</div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default HelpMenu; 