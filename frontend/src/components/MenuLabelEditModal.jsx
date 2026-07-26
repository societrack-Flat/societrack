import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import InputField from './InputField';
import Button from './Button';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabaseClient';
import {
  DEFAULT_FLATS_LABEL,
  DEFAULT_MAINTENANCE_LABEL,
  MAX_MENU_LABEL_LENGTH,
  menuLabelForSave,
  normalizeMenuLabelInput,
} from '../utils/apartmentLabels';

const FIELD_CONFIG = {
  flats: {
    column: 'flats_menu_label',
    title: 'Rename Flats section',
    defaultLabel: DEFAULT_FLATS_LABEL,
    placeholder: 'e.g. Hostel, Rooms',
    helperText: 'Shown on the sidebar button and page title only. Unit numbers stay as 1, 2, 3…',
  },
  maintenance: {
    column: 'maintenance_menu_label',
    title: 'Rename Maintenance section',
    defaultLabel: DEFAULT_MAINTENANCE_LABEL,
    placeholder: 'e.g. Dues, Fees',
    helperText: 'Shown on the sidebar button and page title for admin and residents.',
  },
};

const MenuLabelEditModal = ({ isOpen, onClose, labelType, apartment, onSaved }) => {
  const config = FIELD_CONFIG[labelType] || FIELD_CONFIG.flats;
  const currentValue =
    labelType === 'maintenance'
      ? apartment?.maintenance_menu_label || ''
      : apartment?.flats_menu_label || '';

  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValue(currentValue);
    }
  }, [isOpen, currentValue]);

  const handleSave = async () => {
    if (!apartment?.id) {
      toast.error('No apartment selected');
      return;
    }

    setSaving(true);
    try {
      const payload = { [config.column]: menuLabelForSave(value) };
      const { error } = await supabase.from('apartments').update(payload).eq('id', apartment.id);
      if (error) throw error;

      await onSaved?.();
      toast.success('Section name updated');
      onClose();
    } catch (error) {
      console.error('Error saving menu label:', error);
      toast.error(error?.message || 'Failed to save section name');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setValue('');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={config.title}
      subtitle={`Leave blank to use the default name "${config.defaultLabel}".`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleReset} disabled={saving}>
            Reset to default
          </Button>
          <Button variant="primary" onClick={handleSave} loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <InputField
        label="Section name"
        name="menu_label"
        value={value}
        onChange={(e) => setValue(normalizeMenuLabelInput(e.target.value))}
        placeholder={config.placeholder}
        helperText={config.helperText}
        maxLength={MAX_MENU_LABEL_LENGTH}
      />
    </Modal>
  );
};

export default MenuLabelEditModal;
