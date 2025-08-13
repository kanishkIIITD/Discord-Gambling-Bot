/**
 * Utility functions for handling Discord interactions and timeout warnings
 * This file provides consistent interaction handling across all commands
 */

// Helper function to check if interaction is still valid
function isInteractionValid(interaction) {
  return interaction && 
         interaction.isRepliable && 
         !interaction.replied && 
         !interaction.expired;
}

// Helper function to safely respond to interaction
async function safeInteractionResponse(interaction, content, options = {}) {
  try {
    if (!interaction) {
      console.log('[InteractionUtils] No interaction provided to safeInteractionResponse');
      return false;
    }
    
    // Check if interaction has expired
    if (!interaction.isRepliable) {
      console.log('[InteractionUtils] Interaction expired during safeInteractionResponse');
      return false;
    }
    
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, ...options });
      console.log('[InteractionUtils] Successfully sent response via editReply');
      return true;
    } else if (isInteractionValid(interaction)) {
      await interaction.reply({ content, ...options });
      console.log('[InteractionUtils] Successfully sent response via reply');
      return true;
    } else {
      console.log('[InteractionUtils] Interaction not in valid state for response');
      return false;
    }
  } catch (err) {
    if (err.code === 10062) {
      console.log('[InteractionUtils] Interaction expired during response');
    } else {
      console.error('[InteractionUtils] Failed to send response:', err);
    }
    return false;
  }
}

// Helper function to set up timeout warning for production
function setupTimeoutWarning(interaction, commandName) {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) {
    // Set timeout warning at 2 seconds for production
    const timeout = setTimeout(async () => {
      if (interaction.deferred && !interaction.replied) {
        try {
          await interaction.editReply({ 
            content: '⏰ Command is taking longer than expected. Please wait...',
            ephemeral: true 
          });
        } catch (err) {
          if (err.code === 10062) {
            console.log(`[${commandName}] Interaction expired during timeout warning`);
          } else {
            console.error(`[${commandName}] Failed to send timeout warning:`, err);
          }
        }
      }
    }, 2000);
    
    return timeout;
  }
  return null;
}

// Helper function to safely handle command execution with timeout warnings
async function executeWithTimeoutWarning(interaction, commandName, executionFunction) {
  // Set up timeout warning for production environment
  const timeoutWarning = setupTimeoutWarning(interaction, commandName);
  
  try {
    // Execute the command function
    const result = await executionFunction();
    
    // If the function returns a value, pass it through
    return result;
  } catch (error) {
    console.error(`[${commandName}] Error during command execution:`, error);
    
    // Try to send error message if interaction is still valid
    if (interaction.deferred && !interaction.replied) {
      try {
        await interaction.editReply({
          content: '❌ An error occurred while processing your command. Please try again.',
          ephemeral: true
        });
      } catch (err) {
        if (err.code === 10062) {
          console.log(`[${commandName}] Interaction expired before error message could be sent`);
        } else {
          console.error(`[${commandName}] Failed to send error message:`, err);
        }
      }
    }
    
    // Re-throw the error so the caller can handle it if needed
    throw error;
  } finally {
    // Always clear timeout warning if it was set, regardless of how the function exits
    if (timeoutWarning) {
      clearTimeout(timeoutWarning);
      console.log(`[${commandName}] Cleared timeout warning`);
    }
  }
}

// Helper function to get interaction status for debugging
function getInteractionStatus(interaction) {
  if (!interaction) return 'null';
  return {
    isRepliable: interaction.isRepliable,
    replied: interaction.replied,
    deferred: interaction.deferred,
    expired: !interaction.isRepliable
  };
}

// Helper function to check if interaction has expired
function hasInteractionExpired(interaction) {
  return !interaction || !interaction.isRepliable;
}

// Helper function to safely defer reply with error handling
async function safeDeferReply(interaction, options = {}) {
  try {
    // Check if interaction is already in an invalid state
    if (!interaction || !interaction.isRepliable) {
      console.log('[InteractionUtils] Interaction not repliable during deferReply');
      return false;
    }
    
    if (interaction.replied || interaction.deferred) {
      console.log('[InteractionUtils] Interaction already replied or deferred');
      return false;
    }
    
    await interaction.deferReply(options);
    console.log('[InteractionUtils] Successfully deferred reply');
    return true;
  } catch (err) {
    if (err.code === 10062) {
      console.log('[InteractionUtils] Interaction expired during deferReply');
    } else {
      console.error('[InteractionUtils] Failed to defer reply:', err);
    }
    return false;
  }
}

// Helper function to safely edit reply with error handling
async function safeEditReply(interaction, content, options = {}) {
  try {
    if (interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, ...options });
      return true;
    }
    return false;
  } catch (err) {
    if (err.code === 10062) {
      console.log('[InteractionUtils] Interaction expired during editReply');
      return false;
    }
    console.error('[InteractionUtils] Failed to edit reply:', err);
    return false;
  }
}

// Helper function to safely follow up with error handling
async function safeFollowUp(interaction, content, options = {}) {
  try {
    if (interaction.followUp) {
      await interaction.followUp({ content, ...options });
      return true;
    }
    return false;
  } catch (err) {
    if (err.code === 10062) {
      console.log('[InteractionUtils] Interaction expired during followUp');
      return false;
    }
    console.error('[InteractionUtils] Failed to follow up:', err);
    return false;
  }
}

module.exports = {
  isInteractionValid,
  safeInteractionResponse,
  setupTimeoutWarning,
  executeWithTimeoutWarning,
  getInteractionStatus,
  hasInteractionExpired,
  safeDeferReply,
  safeEditReply,
  safeFollowUp
};
