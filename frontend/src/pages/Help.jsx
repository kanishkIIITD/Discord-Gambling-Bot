import React, { useEffect, useState } from 'react';
import { getDiscordCommands } from '../services/api';

export const Help = () => {
  const [commands, setCommands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return <div className="min-h-screen bg-background text-error flex items-center justify-center">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      <h1 className="text-3xl font-bold text-text-primary mb-6 tracking-tight text-center">Discord Commands</h1>

      <div className="bg-card rounded-lg shadow-lg p-4 sm:p-6">
        {commands.length > 0 ? (
          <div className="space-y-6">
            {commands.map((command, index) => (
              <div key={index} className="pb-4 border-b border-border last:border-b-0">
                <h3 className="text-xl font-semibold text-text-primary mb-2 tracking-wide">/{command.name}</h3>
                <p className="text-text-secondary leading-relaxed tracking-wide">{command.description}</p>
                {command.options && command.options.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-md font-medium text-text-secondary mb-1">Options:</h4>
                    <ul className="list-disc list-inside text-text-secondary leading-relaxed tracking-wide">
                      {command.options.map((option, optIndex) => (
                        <li key={optIndex}>
                          <code>{option.name}</code>: {option.description} {option.required && '(Required)'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-secondary leading-relaxed tracking-wide text-center">No commands found.</p>
        )}
      </div>
    </div>
  );
}; 