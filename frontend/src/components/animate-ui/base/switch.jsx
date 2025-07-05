'use client';

import React from 'react';
import { motion } from 'framer-motion';

export const Switch = ({
  checked,
  onCheckedChange,
  id,
  leftIcon = null,
  rightIcon = null,
  thumbIcon = null,
  className = '',
}) => {
  const handleToggle = () => {
    onCheckedChange(!checked);
  };

  return (
    <motion.button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={handleToggle}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${checked ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'} ${className}`}
      animate={{
        backgroundColor: checked ? 'var(--primary)' : 'var(--primary)',
      }}
      transition={{ duration: 0.2 }}
    >
      {leftIcon && (
        <span className={`absolute left-1 text-xs ${checked ? 'opacity-100' : 'opacity-50'}`}>
          {React.cloneElement(leftIcon, { className: 'w-3 h-3' })}
        </span>
      )}
      
      <motion.span
        className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0"
        animate={{
          // x: checked ? 'calc(100% - 2px)' : '1px',
          x: checked ? '21px' : '3px',
        }}
        transition={{
          type: 'spring',
          stiffness: 500,
          damping: 30,
        }}
      >
        {thumbIcon && (
          <span className="absolute inset-0 flex items-center justify-center text-xs">
            {React.cloneElement(thumbIcon, { className: 'w-3 h-3 text-primary' })}
          </span>
        )}
      </motion.span>
      
      {rightIcon && (
        <span className={`absolute right-1 text-xs ${!checked ? 'opacity-100' : 'opacity-50'}`}>
          {React.cloneElement(rightIcon, { className: 'w-3 h-3' })}
        </span>
      )}
    </motion.button>
  );
};