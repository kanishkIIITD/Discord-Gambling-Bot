import React, { useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { Cross2Icon } from '@radix-ui/react-icons';

const RadixDialog = React.memo(({
  open,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  className = '',
}) => {
  // Memoize animation variants to prevent recreation on each render
  const overlayVariants = useMemo(() => ({
    closed: { opacity: 0 },
    open: { opacity: 1 },
  }), []);

  const contentVariants = useMemo(() => ({
    closed: {
      opacity: 0,
      scale: 0.95,
      y: 10,
    },
    open: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: 'spring',
        damping: 20,
        stiffness: 300,
      },
    },
  }), []);

  const pageLoadVariants = useMemo(() => ({
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        delay: 0.2,
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1.0],
      } 
    },
  }), []);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}

      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            {/* Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                initial="closed"
                animate="open"
                exit="closed"
                variants={overlayVariants}
              />
            </Dialog.Overlay>

            {/* Centered Content */}
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-0 z-50 flex items-center justify-center p-4"
                initial="closed"
                animate="open"
                exit="closed"
                variants={contentVariants}
              >
                <motion.div
                  variants={pageLoadVariants}
                  initial="hidden"
                  animate="visible"
                  className={`relative bg-[var(--surface)] text-[var(--text-primary)] dark:text-[var(--text-primary)] rounded-xl shadow-2xl p-6 max-w-md w-[90vw] max-h-[85vh] overflow-auto border border-gray-200 dark:border-gray-700 font-[var(--font-base)] ${className}`}
                >
                  {/* Close Button */}
                  <Dialog.Close asChild>
                    <button
                      className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full h-8 w-8 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] transition-colors duration-200"
                      aria-label="Close"
                    >
                      <Cross2Icon />
                    </button>
                  </Dialog.Close>

                  {/* Title */}
                  {title && (
                    <Dialog.Title className="text-xl font-bold mb-3 font-[var(--font-heading)]">
                      {title}
                    </Dialog.Title>
                  )}

                  {/* Description */}
                  {description && (
                    <Dialog.Description className="text-sm leading-relaxed text-[var(--text-secondary)] mb-5 font-[var(--font-base)]">
                      {description}
                    </Dialog.Description>
                  )}

                  {/* Children */}
                  <div className="font-[var(--font-base)]">
                    {children}
                  </div>
                </motion.div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
});

// Using React.memo to prevent unnecessary re-renders
export default RadixDialog;
