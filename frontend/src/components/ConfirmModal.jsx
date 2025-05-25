import React from 'react';

export const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel", loading }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-lg shadow-lg p-6 max-w-sm w-full">
        <h2 className="text-xl font-bold text-text-primary mb-4">{title}</h2>
        <div className="mb-4 text-text-secondary">{message}</div>
        <div className="flex gap-2 mt-4">
          <button
            onClick={onConfirm}
            className="flex-1 py-2 px-4 rounded bg-primary text-white font-semibold hover:bg-primary/90"
            disabled={loading}
          >
            {confirmText}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="flex-1 py-2 px-4 rounded bg-surface text-text-primary border border-border font-semibold hover:bg-primary/5"
              disabled={loading}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};