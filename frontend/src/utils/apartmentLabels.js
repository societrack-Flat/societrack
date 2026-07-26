const DEFAULT_FLATS_LABEL = 'Flats';
const DEFAULT_MAINTENANCE_LABEL = 'Maintenance';
const MAX_MENU_LABEL_LENGTH = 30;

export function getFlatsMenuLabel(apartment) {
  const custom = apartment?.flats_menu_label?.trim();
  return custom || DEFAULT_FLATS_LABEL;
}

export function getMaintenanceMenuLabel(apartment) {
  const custom = apartment?.maintenance_menu_label?.trim();
  return custom || DEFAULT_MAINTENANCE_LABEL;
}

export function normalizeMenuLabelInput(value) {
  return String(value ?? '').trim().slice(0, MAX_MENU_LABEL_LENGTH);
}

export function menuLabelForSave(value) {
  const trimmed = normalizeMenuLabelInput(value);
  return trimmed || null;
}

export { DEFAULT_FLATS_LABEL, DEFAULT_MAINTENANCE_LABEL, MAX_MENU_LABEL_LENGTH };
