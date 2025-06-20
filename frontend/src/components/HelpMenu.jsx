import React, { useState } from 'react';
import { Navigation } from './Navigation';
import { commandCategories } from '../data/commands';

const HelpMenu = () => {
  const [selectedCategory, setSelectedCategory] = useState(commandCategories[0].name);
  const [expanded, setExpanded] = useState(null);

  const filteredCommands = commandCategories.find(cat => cat.name === selectedCategory).commands;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight">Command Reference</h1>
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-2 mb-8">
            {commandCategories.map(cat => (
              <button
                key={cat.name}
                className={`px-4 py-2 rounded-lg font-semibold transition-colors text-base border focus:outline-none ${selectedCategory === cat.name ? 'bg-primary text-white border-primary' : 'bg-background text-text-primary border-gray-300 hover:bg-[#4752C4] focus:bg-[#4752C4'}`}
                onClick={() => {
                  setSelectedCategory(cat.name);
                  setExpanded(null);
                }}
                aria-current={selectedCategory === cat.name ? 'page' : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
          {/* Command List */}
          <div className="divide-y divide-gray-200">
            {filteredCommands.length === 0 && (
              <div className="py-12 text-center text-text-secondary text-lg">No commands found.</div>
            )}
            {filteredCommands.map(cmd => (
              <div key={cmd.name} className="">
                <button
                  className="w-full text-left py-4 px-3 flex items-center justify-between rounded-lg hover:bg-[#2A2D31] focus:bg-[#2A2D31] focus:outline-none transition group"
                  onClick={() => setExpanded(expanded === cmd.name ? null : cmd.name)}
                  aria-expanded={expanded === cmd.name}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="font-mono font-semibold text-primary text-lg truncate">/{cmd.name}</span>
                    <span className="text-text-secondary text-sm truncate">{cmd.description}</span>
                  </div>
                  <span className="ml-4 text-primary text-xl group-hover:text-primary-dark transition">{expanded === cmd.name ? '▲' : '▼'}</span>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-300 ${expanded === cmd.name ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                  style={{ willChange: 'max-height, opacity' }}
                >
                  {expanded === cmd.name && (
                    <div className="bg-background border border-gray-200 rounded-lg shadow-inner p-5 mb-4 animate-fadeIn">
                      <div className="mb-3">
                        <span className="block text-text-primary font-semibold mb-1">Description</span>
                        <span className="block text-text-secondary text-base">{cmd.description}</span>
                      </div>
                      <div className="mb-3">
                        <span className="block text-text-primary font-semibold mb-1">Usage</span>
                        <code className="block bg-card rounded px-3 py-2 text-base text-primary whitespace-pre-wrap border border-gray-200">{cmd.usage}</code>
                      </div>
                      {cmd.instructions && cmd.instructions.trim() && (
                        <div className="mb-3">
                          <span className="block text-text-primary font-semibold mb-1">Instructions</span>
                          <span className="block text-text-secondary text-base">{cmd.instructions}</span>
                        </div>
                      )}
                      {cmd.category && (
                        <div className="text-xs text-primary mt-2">Category: {cmd.category}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default HelpMenu; 