import { Navigation } from '../components/Navigation';
import { motion } from 'framer-motion';
import { useLoading } from '../hooks/useLoading';
import LoadingSpinner from '../components/LoadingSpinner';

export const BotPermissions = () => {
  const { isLoading } = useLoading();
  
  // Define loading key for bot permissions page
  const LOADING_KEY = 'bot-permissions';
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
          <h1 className="text-3xl font-bold text-text-primary mb-8 tracking-tight font-display">Bot Permissions</h1>
          
          <div className="prose prose-invert max-w-none text-sm sm:text-base">
            <p className="text-text-secondary leading-relaxed tracking-wide mb-6 font-base">
              To ensure Gambling Bot functions properly, it requires the following permissions when added to your Discord server. <strong>We do <span className='text-warning'>not</span> request Administrator permissions.</strong>
            </p>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">Required Permissions</h2>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div className="bg-background p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-text-primary mb-4 tracking-wide font-heading">Bot Permissions</h3>
                <ul className="space-y-3 text-text-secondary leading-relaxed tracking-wide font-base">
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
                <span className="text-text-secondary font-base">No admin permissions required.<br/>Safe for your server.</span>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight font-heading">How to Add the Bot</h2>
            <div className="bg-background p-6 rounded-lg mb-8">
              <ol className="list-decimal pl-6 space-y-4 text-text-secondary leading-relaxed tracking-wide font-base">
                <li>Click the "Add to Discord" button below</li>
                <li>Select your server from the dropdown menu</li>
                <li>Review and confirm the required permissions</li>
                <li>Complete the verification process</li>
              </ol>
            </div>

            <div className="text-center">
              <motion.a
                whileHover={{ scale: 1.05, boxShadow: "0px 0px 12px rgba(255,255,255,0.3)" }}
                whileTap={{ scale: 0.95 }}
                href={`https://discord.com/api/oauth2/authorize?client_id=${process.env.REACT_APP_DISCORD_CLIENT_ID}&permissions=1101659326464&scope=bot%20applications.commands`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary tracking-wide transition-colors font-base"
                disabled={isLoading(LOADING_KEY)}
              >
                {isLoading(LOADING_KEY) ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Adding...
                  </>
                ) : 'Add to Discord'}
              </motion.a>
            </div>

            <h2 className="text-2xl font-bold text-text-primary mb-4 tracking-tight mt-12 font-heading">Important Notes</h2>
            <div className="bg-background p-6 rounded-lg">
              <ul className="space-y-4 text-text-secondary leading-relaxed tracking-wide font-base">
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
      </motion.div>
    </div>
  );
};