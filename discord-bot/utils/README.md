# Discord Bot Utilities

This directory contains utility functions for the Discord bot to handle common operations and improve code consistency.

## Interaction Utilities (`interactionUtils.js`)

The `interactionUtils.js` file provides comprehensive utilities for handling Discord interactions, timeout warnings, and error management. This helps prevent the common "Unknown interaction" error (code 10062) that occurs when interactions expire before responses can be sent.

### Key Features

- **Timeout Warnings**: Automatically shows a warning message after 2 seconds in production environments
- **Safe Interaction Handling**: Gracefully handles expired interactions without throwing errors
- **Consistent Error Management**: Standardized approach to error handling across all commands
- **Production Environment Detection**: Automatically detects production vs development environments

### Usage Examples

#### Basic Command with Timeout Warning

```javascript
const { executeWithTimeoutWarning, safeDeferReply } = require('../utils/interactionUtils');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command'),

  async execute(interaction) {
    await executeWithTimeoutWarning(interaction, 'example', async () => {
      // Defer the reply safely
      const deferSuccess = await safeDeferReply(interaction);
      if (!deferSuccess) return;
      
      // Your command logic here
      // The timeout warning will automatically show after 2 seconds in production
      
      await interaction.editReply('Command completed!');
    });
  }
};
```

#### Safe Interaction Responses

```javascript
const { safeInteractionResponse } = require('../utils/interactionUtils');

// Instead of direct interaction.reply() or interaction.editReply()
const success = await safeInteractionResponse(
  interaction,
  'Your message here',
  { ephemeral: true }
);

if (!success) {
  // Interaction expired or failed - handle gracefully
  return;
}
```

#### Safe Defer Reply

```javascript
const { safeDeferReply } = require('../utils/interactionUtils');

// Instead of interaction.deferReply()
const deferSuccess = await safeDeferReply(interaction, { ephemeral: true });
if (!deferSuccess) {
  // Interaction expired during defer - exit early
  return;
}
```

### Available Functions

#### `executeWithTimeoutWarning(interaction, commandName, executionFunction)`
Wraps command execution with automatic timeout warnings and error handling.

**Parameters:**
- `interaction`: The Discord interaction object
- `commandName`: String identifier for the command (used in logging)
- `executionFunction`: Async function containing the command logic

**Returns:** Promise that resolves when execution completes

#### `safeInteractionResponse(interaction, content, options)`
Safely sends a response to an interaction, handling expired interactions gracefully.

**Parameters:**
- `interaction`: The Discord interaction object
- `content`: Message content to send
- `options`: Additional options (ephemeral, embeds, etc.)

**Returns:** Boolean indicating success/failure

#### `setupTimeoutWarning(interaction, commandName)`
Sets up a timeout warning that shows after 2 seconds in production environments.

**Parameters:**
- `interaction`: The Discord interaction object
- `commandName`: String identifier for the command

**Returns:** Timeout ID (or null if not in production)

#### `safeDeferReply(interaction, options)`
Safely defers a reply with error handling.

**Parameters:**
- `interaction`: The Discord interaction object
- `options`: Defer options (ephemeral, etc.)

**Returns:** Boolean indicating success/failure

#### `safeEditReply(interaction, content, options)`
Safely edits a deferred reply.

**Parameters:**
- `interaction`: The Discord interaction object
- `content`: New content
- `options`: Additional options

**Returns:** Boolean indicating success/failure

#### `safeFollowUp(interaction, content, options)`
Safely sends a follow-up message.

**Parameters:**
- `interaction`: The Discord interaction object
- `content`: Message content
- `options`: Additional options

**Returns:** Boolean indicating success/failure

#### `isInteractionValid(interaction)`
Checks if an interaction is still valid and can be responded to.

**Parameters:**
- `interaction`: The Discord interaction object

**Returns:** Boolean indicating validity

#### `hasInteractionExpired(interaction)`
Checks if an interaction has expired.

**Parameters:**
- `interaction`: The Discord interaction object

**Returns:** Boolean indicating if expired

#### `getInteractionStatus(interaction)`
Gets detailed status information about an interaction for debugging.

**Parameters:**
- `interaction`: The Discord interaction object

**Returns:** Object with interaction status details

### Environment Detection

The utilities automatically detect the environment using `process.env.NODE_ENV`:

- **Production**: `NODE_ENV === 'production'` - Timeout warnings enabled
- **Development**: Any other value - Timeout warnings disabled

### Best Practices

1. **Always use `executeWithTimeoutWarning`** for commands that might take time to execute
2. **Use safe interaction functions** instead of direct Discord.js methods
3. **Check return values** from safe functions to handle failures gracefully
4. **Wrap command logic** in the timeout warning function for consistent behavior
5. **Use descriptive command names** for better logging and debugging

### Migration Guide

To migrate existing commands to use these utilities:

1. Import the required functions from `../utils/interactionUtils`
2. Wrap your command logic in `executeWithTimeoutWarning`
3. Replace direct interaction calls with safe alternatives
4. Add proper error handling using the utility functions

### Example Migration

**Before:**
```javascript
async execute(interaction) {
  await interaction.deferReply();
  // ... command logic
  await interaction.editReply('Done!');
}
```

**After:**
```javascript
async execute(interaction) {
  await executeWithTimeoutWarning(interaction, 'commandname', async () => {
    const deferSuccess = await safeDeferReply(interaction);
    if (!deferSuccess) return;
    
    // ... command logic
    
    await interaction.editReply('Done!');
  });
}
```

This approach provides better error handling, timeout warnings, and consistent behavior across all commands.
