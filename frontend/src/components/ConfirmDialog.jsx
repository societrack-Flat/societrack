import React from 'react';
import Modal from './Modal';
import Button from './Button';

export default function ConfirmDialog({
  isOpen,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'primary',
  loading = false,
  onCancel,
  onConfirm,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} subtitle={message}>
      <div className="flex gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} fullWidth disabled={loading}>
          {cancelText}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} fullWidth loading={loading}>
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}

