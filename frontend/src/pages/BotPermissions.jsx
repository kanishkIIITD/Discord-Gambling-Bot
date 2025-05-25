import { Navigation } from '../components/Navigation';

export const BotPermissions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-card rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight">Bot Permissions</h1>
          
          <div className="prose prose-invert max-w-none">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              To ensure Gambling Bot functions properly, it requires the following permissions when added to your Discord server.
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">Required Permissions</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-background p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">General Permissions</h3>
                <ul className="space-y-3 text-text-secondary leading-relaxed tracking-wide">
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Read Messages/View Channels
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Send Messages
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Embed Links
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Attach Files
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Read Message History
                  </li>
                </ul>
              </div>

              <div className="bg-background p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Moderation Permissions</h3>
                <ul className="space-y-3 text-text-secondary leading-relaxed tracking-wide">
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Manage Messages
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Add Reactions
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Use External Emojis
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Create Public Threads
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Send Messages in Threads
                  </li>
                </ul>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">How to Add the Bot</h2>
            <div className="bg-background p-6 rounded-lg mb-8">
              <ol className="list-decimal pl-6 space-y-4 text-text-secondary leading-relaxed tracking-wide">
                <li>Click the "Add to Discord" button below</li>
                <li>Select your server from the dropdown menu</li>
                <li>Review and confirm the required permissions</li>
                <li>Complete the verification process</li>
              </ol>
            </div>

            <div className="text-center">
              <a
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=8&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide"
              >
                Add to Discord
              </a>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight mt-12">Important Notes</h2>
            <div className="bg-background p-6 rounded-lg">
              <ul className="space-y-4 text-text-secondary leading-relaxed tracking-wide">
                <li className="flex items-start">
                  <span className="text-warning mr-2">⚠</span>
                  <span>The bot requires these permissions to function properly. Without them, some features may not work as expected.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-warning mr-2">⚠</span>
                  <span>Make sure the bot has a role with sufficient permissions in your server.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-warning mr-2">⚠</span>
                  <span>If you need to modify permissions later, you can do so through your server's role settings.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}; 