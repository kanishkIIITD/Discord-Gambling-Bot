'use client';

import React from 'react';

export const Label = React.forwardRef(({ htmlFor, children, className = '', ...props }, ref) => {
  return (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 ${className}`}
      {...props}
    >
      {children}
    </label>
  );
});

Label.displayName = 'Label';