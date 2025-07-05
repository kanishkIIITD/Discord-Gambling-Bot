import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { prefetchHeartbeat } from '../services/heartbeat';
import { useGuildStore, useUIStore } from '../store';
import LoadingSpinner from '../components/LoadingSpinner';
import { ChevronDownIcon } from '@heroicons/react/20/solid';

const GuildSelector = () => {
  const userGuilds = useGuildStore(state => state.guilds);
  const selectedGuildId = useGuildStore(state => state.selectedGuildId);
  const selectGuild = useGuildStore(state => state.selectGuild);
  const isGuildSwitching = useGuildStore(state => state.isGuildSwitching);
  const selectedGuild = useGuildStore(state => state.guilds.find(g => g.id === state.selectedGuildId));
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isLoading = useUIStore(state => state.isLoading);

  const LOADING_KEYS = {
    GUILD_LOADING: 'guild-loading',
    GUILD_SWITCHING: 'guild-switching',
  };

  const memoizedSelectedGuild = useMemo(() => selectedGuild, [selectedGuild?.id]);
  const memoizedUserGuilds = useMemo(() => userGuilds, [userGuilds?.length, userGuilds?.map(g => g.id).join(',')]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGuildSelect = (guildId) => {
    selectGuild(guildId);
    setIsOpen(false);
  };

  const getGuildAvatar = (guild) => {
    return guild.icon ? (
      <img
        src={`https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`}
        alt={guild.name}
        className="w-6 h-6 rounded-full object-cover"
      />
    ) : (
      <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold">
        {guild.name.charAt(0)}
      </div>
    );
  };

  if (!userGuilds || isLoading(LOADING_KEYS.GUILD_LOADING)) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-info border border-info/40 rounded-lg bg-surface/50">
        <LoadingSpinner size="sm" />
        <span className="hidden sm:inline">Loading guilds...</span>
        <span className="sm:hidden">Loading...</span>
      </div>
    );
  }

  if (userGuilds.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm text-warning border border-warning/40 rounded-lg bg-surface/50">
        <span className="hidden sm:inline">Using default server</span>
        <span className="sm:hidden">Default</span>
      </div>
    );
  }

  return (
    <motion.div animate={isOpen ? 'open' : 'closed'} className="relative font-base" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        onMouseEnter={prefetchHeartbeat}
        disabled={isGuildSwitching || isLoading(LOADING_KEYS.GUILD_SWITCHING)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-text-primary bg-surface hover:bg-surface/90 border border-border transition-colors min-w-0 max-w-full"
      >
        {selectedGuild && (
          <>
            {getGuildAvatar(selectedGuild)}
            <span className="max-w-[120px] lg:max-w-[150px] xl:max-w-[200px] truncate font-medium">
              {selectedGuild.name}
            </span>
            {isGuildSwitching || isLoading(LOADING_KEYS.GUILD_SWITCHING) ? (
              <LoadingSpinner size="xs" className="ml-1 flex-shrink-0" />
            ) : (
              <motion.span variants={iconVariants} className="flex-shrink-0">
                <ChevronDownIcon className="h-4 w-4 text-text-secondary" />
              </motion.span>
            )}
          </>
        )}
      </button>

      {isOpen && (
        <motion.ul
          initial="closed"
          variants={wrapperVariants}
          style={{ originY: 'top', translateX: '-50%' }}
          className="flex flex-col gap-1 p-2 rounded-lg bg-surface shadow-lg absolute top-[120%] left-[50%] w-56 z-50 border border-border max-h-64 overflow-y-auto"
        >
          {userGuilds.map((guild) => (
            <motion.li
              key={guild.id}
              variants={itemVariants}
              onClick={() => handleGuildSelect(guild.id)}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium whitespace-nowrap rounded-md transition-colors cursor-pointer ${
                selectedGuildId === guild.id
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-primary/5 text-text-primary hover:text-primary'
              }`}
            >
              <motion.span variants={actionIconVariants} className="flex-shrink-0">
                {getGuildAvatar(guild)}
              </motion.span>
              <span className="truncate">{guild.name}</span>
            </motion.li>
          ))}
        </motion.ul>
      )}
    </motion.div>
  );
};

export default GuildSelector;

// Animation variants
const wrapperVariants = {
  open: {
    scaleY: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.08,
    },
  },
  closed: {
    scaleY: 0,
    transition: {
      when: 'afterChildren',
      staggerChildren: 0.05,
    },
  },
};

const iconVariants = {
  open: { rotate: 180 },
  closed: { rotate: 0 },
};

const itemVariants = {
  open: {
    opacity: 1,
    y: 0,
    transition: { when: 'beforeChildren' },
  },
  closed: {
    opacity: 0,
    y: -15,
    transition: { when: 'afterChildren' },
  },
};

const actionIconVariants = {
  open: { scale: 1, y: 0 },
  closed: { scale: 0.9, y: -7 },
};
