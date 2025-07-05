import { create } from 'zustand';
import { persist, devtools } from 'zustand/middleware';
import * as api from '../services/api';
import axios from '../services/axiosConfig';

/**
 * Guild store for managing guild selection and related data
 * Replaces the GuildContext with a more robust state management solution
 */
export const useGuildStore = create(
  devtools(
    persist(
      (set, get) => ({
        // State
        guilds: [],
        selectedGuildId: null,
        isGuildSwitching: false,
        loading: false,
        error: null,
        pendingGuildSwitch: null, // Track the guild we're switching to
        guildSwitchTimeoutId: null, // Track the fallback timeout
        
        // Actions
        fetchGuilds: async (discordId) => {
          if (!discordId) return;
          
          // console.log('[GuildStore] Fetching guilds for discordId:', discordId);
          
          try {
            set({ loading: true, error: null });
            const guilds = await api.getUserGuilds(discordId);
            // console.log('[GuildStore] Fetched guilds:', guilds.length);
            set({ guilds, loading: false });
            
            // Validate the current selectedGuildId against the fetched guilds
            const currentState = get();
            // console.log('[GuildStore] Current selectedGuildId:', currentState.selectedGuildId);
            
            if (currentState.selectedGuildId) {
              // Check if the selected guild is still in the user's guilds
              const selectedGuildExists = guilds.some(guild => guild.id === currentState.selectedGuildId);
              if (!selectedGuildExists) {
                // console.log('[GuildStore] Selected guild no longer exists, clearing selection');
                set({ selectedGuildId: null });
              } else {
                // console.log('[GuildStore] Selected guild is still valid:', currentState.selectedGuildId);
              }
            }
            
            // If no guild is selected yet and we have guilds, select the first one
            if (!get().selectedGuildId && guilds.length > 0) {
              // console.log('[GuildStore] Auto-selecting first guild:', guilds[0].id);
              get().selectGuild(guilds[0].id);
            } else if (!guilds.length) {
              // console.log('[GuildStore] No guilds available to select');
            }
            
            return guilds;
          } catch (error) {
            console.error('[GuildStore] Error fetching guilds:', error);
            set({ 
              error: error.message || 'Failed to fetch guilds', 
              loading: false 
            });
          }
        },
        
        selectGuild: (guildId) => {
          const currentGuildId = get().selectedGuildId;
          // console.log('[GuildStore] Selecting guild:', guildId, 'current:', currentGuildId);
          
          // If selecting the same guild, do nothing
          if (currentGuildId === guildId) {
            // console.log('[GuildStore] Same guild selected, no action needed');
            return;
          }
          
          // Clear any existing timeout
          const currentState = get();
          if (currentState.guildSwitchTimeoutId) {
            clearTimeout(currentState.guildSwitchTimeoutId);
          }
          
          // Start guild switching process immediately
          set({ 
            isGuildSwitching: true, 
            pendingGuildSwitch: guildId 
          });
          
          // console.log('[GuildStore] Guild switching started for:', guildId);
          // console.log('[GuildStore] State after starting switch:', {
          //   isGuildSwitching: get().isGuildSwitching,
          //   pendingGuildSwitch: get().pendingGuildSwitch
          // });
          
          // Update state with new guild ID (persist middleware will handle localStorage)
          set({ selectedGuildId: guildId });
          // console.log('[GuildStore] Guild selected:', guildId);
          
          // Update axios headers immediately
          axios.defaults.headers.common['x-guild-id'] = guildId;
          localStorage.setItem('selectedGuildId', guildId);
          
          // Trigger user profile refetch after a short delay to ensure the new guild ID is set
          setTimeout(() => {
            // This will trigger the useUserProfile hook to refetch with the new guild ID
            // console.log('[GuildStore] Triggering user profile refetch for new guild');
          }, 100);
          
          // Fallback timeout to ensure guild switching doesn't get stuck
          // This will complete the switch after 5 seconds if the profile update doesn't happen
          const timeoutId = setTimeout(() => {
            const currentState = get();
            // console.log('[GuildStore] Fallback timeout triggered:', {
            //   isGuildSwitching: currentState.isGuildSwitching,
            //   pendingGuildSwitch: currentState.pendingGuildSwitch,
            //   selectedGuildId: currentState.selectedGuildId
            // });
            if (currentState.isGuildSwitching && currentState.pendingGuildSwitch === guildId) {
              // console.log('[GuildStore] Fallback: Completing guild switch after timeout');
              set({ 
                isGuildSwitching: false, 
                pendingGuildSwitch: null,
                guildSwitchTimeoutId: null
              });
            }
          }, 5000); // 5 second fallback
          
          // Store the timeout ID
          set({ guildSwitchTimeoutId: timeoutId });
        },
        
        // New method to complete guild switching after user profile is updated
        completeGuildSwitch: () => {
          const currentState = get();
          // console.log('[GuildStore] Attempting to complete guild switch:', {
          //   isGuildSwitching: currentState.isGuildSwitching,
          //   pendingGuildSwitch: currentState.pendingGuildSwitch,
          //   selectedGuildId: currentState.selectedGuildId
          // });
          
          if (currentState.isGuildSwitching && currentState.pendingGuildSwitch === currentState.selectedGuildId) {
            // console.log('[GuildStore] Completing guild switch after profile update');
            
            // Clear the fallback timeout
            if (currentState.guildSwitchTimeoutId) {
              clearTimeout(currentState.guildSwitchTimeoutId);
              // console.log('[GuildStore] Cleared fallback timeout');
            }
            
            set({ 
              isGuildSwitching: false, 
              pendingGuildSwitch: null,
              guildSwitchTimeoutId: null
            });
            
            // console.log('[GuildStore] Guild switch completed successfully');
            return true;
          } else if (currentState.isGuildSwitching) {
            // console.log('[GuildStore] Guild switching in progress but conditions not met for completion:', {
            //   pendingGuildSwitch: currentState.pendingGuildSwitch,
            //   selectedGuildId: currentState.selectedGuildId
            // });
            return false;
          } else {
            // console.log('[GuildStore] No guild switching in progress');
            return false;
          }
        },
        
        getSelectedGuild: () => {
          const { guilds, selectedGuildId } = get();
          return guilds.find(guild => guild.id === selectedGuildId) || null;
        },
        
        clearError: () => set({ error: null }),
        
        // Initialize the store - call this after the store is hydrated
        initialize: () => {
          const state = get();
          // console.log('[GuildStore] Initializing store:', {
          //   selectedGuildId: state.selectedGuildId,
          //   guildsCount: state.guilds.length,
          //   isGuildSwitching: state.isGuildSwitching,
          //   pendingGuildSwitch: state.pendingGuildSwitch
          // });
          
          // If we have a selected guild ID but no guilds, we need to fetch guilds
          // This will be handled by the components that use the store
          if (state.selectedGuildId && state.guilds.length === 0) {
            // console.log('[GuildStore] Has selectedGuildId but no guilds - need to fetch');
          }
        },

        // Debug method to manually test guild switching
        debugGuildSwitch: () => {
          const state = get();
          // console.log('[GuildStore] Debug - Current state:', {
          //   isGuildSwitching: state.isGuildSwitching,
          //   pendingGuildSwitch: state.pendingGuildSwitch,
          //   selectedGuildId: state.selectedGuildId,
          //   guildsCount: state.guilds.length
          // });
        },

        // Force reset guild switching state if it gets stuck
        resetGuildSwitching: () => {
          const currentState = get();
          // console.log('[GuildStore] Force resetting guild switching state');
          
          // Clear any existing timeout
          if (currentState.guildSwitchTimeoutId) {
            clearTimeout(currentState.guildSwitchTimeoutId);
          }
          
          set({ 
            isGuildSwitching: false, 
            pendingGuildSwitch: null,
            guildSwitchTimeoutId: null
          });
        },

        // Test method to manually set guild switching state
        testGuildSwitching: (guildId) => {
          // console.log('[GuildStore] Testing guild switching to:', guildId);
          set({ 
            isGuildSwitching: true, 
            pendingGuildSwitch: guildId,
            selectedGuildId: guildId
          });
          
          // Auto-complete after 3 seconds for testing
          setTimeout(() => {
            // console.log('[GuildStore] Auto-completing test guild switch');
            set({ 
              isGuildSwitching: false, 
              pendingGuildSwitch: null,
              guildSwitchTimeoutId: null
            });
          }, 3000);
        },
      }),
      {
        name: 'guild-storage', // unique name for localStorage
        partialize: (state) => ({ selectedGuildId: state.selectedGuildId }), // only persist selectedGuildId
        onRehydrateStorage: () => (state) => {
          // This runs after the store is rehydrated from localStorage
          // console.log('[GuildStore] Rehydrating store:', {
          //   selectedGuildId: state?.selectedGuildId,
          //   guildsCount: state?.guilds?.length || 0,
          //   isGuildSwitching: state?.isGuildSwitching,
          //   pendingGuildSwitch: state?.pendingGuildSwitch
          // });
          
          if (state && state.selectedGuildId && state.guilds.length === 0) {
            // If we have a selected guild ID but no guilds loaded, we need to fetch guilds
            // This will be handled by the components that use the store
            // console.log('[GuildStore] Rehydrated with selectedGuildId:', state.selectedGuildId);
          }
        },
      }
    ),
    { name: 'guild-store' }
  )
);