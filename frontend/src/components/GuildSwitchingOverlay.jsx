import React from 'react';
import { useGuildStore } from '../store';

export const GuildSwitchingOverlay = () => {
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const selectedGuild = useGuildStore(state => state.getSelectedGuild());
  const pendingGuildSwitch = useGuildStore(state => state.pendingGuildSwitch);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  // Debug functions - only used in development mode
  const debugGuildSwitch = useGuildStore(state => state.debugGuildSwitch);
  const selectGuild = useGuildStore(state => state.selectGuild);
  const resetGuildSwitching = useGuildStore(state => state.resetGuildSwitching);
  const testGuildSwitching = useGuildStore(state => state.testGuildSwitching);

  // Debug logging
  // console.log('[GuildSwitchingOverlay] Render state:', {
  //   isGuildSwitching,
  //   selectedGuildId,
  //   pendingGuildSwitch,
  //   selectedGuild: selectedGuild?.name
  // });

  if (!isGuildSwitching) {
    // console.log('[GuildSwitchingOverlay] Not showing overlay - isGuildSwitching is false');
    return null;
  }

  // console.log('[GuildSwitchingOverlay] Showing overlay - z-index: 99999');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-[99999] flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-600 border-t-transparent mb-6"></div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 text-center">
            Switching Server
          </h3>
          {selectedGuild && (
            <p className="text-base text-gray-600 dark:text-gray-300 text-center mb-2">
              Loading data for <span className="font-semibold">{selectedGuild.name}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default GuildSwitchingOverlay;