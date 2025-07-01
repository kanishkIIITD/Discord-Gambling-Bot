import React from 'react';
import RadixDialog from './RadixDialog';

export const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", loading }) => {
  return (
    <RadixDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen && onCancel) {
          onCancel();
        }
      }}
      title={title}
    >
      <div className="mb-4 text-text-secondary">{message}</div>
      <div className="flex gap-2 mt-6">
        <button
          onClick={onConfirm}
          className="flex-1 py-2 px-4 rounded bg-primary text-white font-semibold hover:bg-primary/90 transition-colors"
          disabled={loading}
        >
          {confirmText}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="flex-1 py-2 px-4 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5 transition-colors"
            disabled={loading}
          >
            {cancelText}
          </button>
        )}
      </div>
    </RadixDialog>
  );
};