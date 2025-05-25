const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const User = require('../models/User');

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

passport.use(new DiscordStrategy({
  clientID: process.env.DISCORD_CLIENT_ID,
  clientSecret: process.env.DISCORD_CLIENT_SECRET,
  callbackURL: process.env.DISCORD_CALLBACK_URL,
  scope: ['identify', 'email', 'guilds']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    // Find or create user
    let user = await User.findOne({ discordId: profile.id });
    
    if (!user) {
      user = await User.create({
        discordId: profile.id,
        username: profile.username,
        email: profile.email,
        avatar: profile.avatar
      });
    } else {
      // Update user info
      user.username = profile.username;
      user.email = profile.email;
      user.avatar = profile.avatar;
      await user.save();
    }

    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
}));

module.exports = passport; 