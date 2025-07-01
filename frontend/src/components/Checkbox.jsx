import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from '@radix-ui/react-icons';
import { motion, AnimatePresence } from 'framer-motion';

export function Checkbox({ checked, onCheckedChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <CheckboxPrimitive.Root
        checked={checked}
        onCheckedChange={onCheckedChange}
        className={
          `w-5 h-5 rounded border transition-colors duration-150 flex items-center justify-center
          bg-background border-border
          ${checked ? 'bg-primary border-primary' : 'bg-background border-border'}`
        }
        aria-checked={checked}
      >
        <AnimatePresence>
          {checked && (
            <CheckboxPrimitive.Indicator forceMount asChild>
              <motion.div
                key="check"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              >
                <CheckIcon className="w-4 h-4 text-white" />
              </motion.div>
            </CheckboxPrimitive.Indicator>
          )}
        </AnimatePresence>
      </CheckboxPrimitive.Root>
      <span className="font-medium text-text-primary text-base font-base">{label}</span>
    </label>
  );
}
