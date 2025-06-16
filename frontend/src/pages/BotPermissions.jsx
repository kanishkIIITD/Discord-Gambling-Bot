import { Navigation } from '../components/Navigation';

export const BotPermissions = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full">
        <div className="bg-card rounded-lg shadow-lg p-4 sm:p-8">
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight">Bot Permissions</h1>
          
          <div className="prose prose-invert max-w-none text-sm sm:text-base">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6">
              To ensure Gambling Bot functions properly, it requires the following permissions when added to your Discord server. <strong>We do <span className='text-warning'>not</span> request Administrator permissions.</strong>
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight">Required Permissions</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-background p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide">Bot Permissions</h3>
                <ul className="space-y-3 text-text-secondary leading-relaxed tracking-wide">
                <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Timeout Members
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
                    Mention Everyone
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Read Message History
                  </li>
                  <li className="flex items-center">
                    <span className="text-success mr-2">✓</span>
                    Use Application Commands (Slash Commands)
                  </li>
                </ul>
              </div>
              <div className="bg-background p-6 rounded-lg flex flex-col justify-center items-center text-center">
                <span className="text-4xl mb-2">🔒</span>
                <span className="text-text-secondary">No admin permissions required.<br/>Safe for your server.</span>
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
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=1101659326464&scope=bot%20applications.commands`}
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
                  <span>Make sure the bot role is higher in hierarchy than the users you want to timeout.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-warning mr-2">⚠</span>
                  <span>If the server want to have logs of the timeout, an admin can use /setlogchannel to set the channel for the logs.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-warning mr-2">⚠</span>
                  <span>If the server want members to get notification of a bet being created/resolved, the members need to have "Gamblers" role.</span>
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