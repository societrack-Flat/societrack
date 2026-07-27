const DEFAULT_FLATS_LABEL = 'Flats';
const DEFAULT_MAINTENANCE_LABEL = 'Maintenance';
const MAX_MENU_LABEL_LENGTH = 30;

/** Stored in DB / income category — do not change when admin renames the section. */
export const MAINTENANCE_CATEGORY_VALUE = 'Maintenance';

export function getFlatsMenuLabel(apartment) {
  const custom = apartment?.flats_menu_label?.trim();
  return custom || DEFAULT_FLATS_LABEL;
}

export function getMaintenanceMenuLabel(apartment) {
  const custom = apartment?.maintenance_menu_label?.trim();
  return custom || DEFAULT_MAINTENANCE_LABEL;
}

function flatsLabelLower(apartment) {
  return getFlatsMenuLabel(apartment).toLowerCase();
}

function flatsUnitSingular(apartment) {
  const label = getFlatsMenuLabel(apartment);
  if (label === DEFAULT_FLATS_LABEL) return 'flat';
  if (label.toLowerCase().endsWith('s')) return label.slice(0, -1).toLowerCase();
  return label.toLowerCase();
}

export function flatsTabReference(apartment) {
  return getFlatsMenuLabel(apartment);
}

/** Table column for unit numbers (1, 2, 3 — no custom prefix). */
export function flatNumberColumnLabel() {
  return 'No.';
}

export function flatNumberFieldLabel(apartment) {
  return getFlatsMenuLabel(apartment) === DEFAULT_FLATS_LABEL ? 'Flat Number' : 'Number';
}

export function flatSelectFieldLabel(apartment) {
  return getFlatsMenuLabel(apartment);
}

export function selectFlatLabel(apartment, optional = false) {
  const base = `Select ${getFlatsMenuLabel(apartment)}`;
  return optional ? `${base} (Optional)` : base;
}

export function totalFlatsLabel(apartment) {
  return `Total ${getFlatsMenuLabel(apartment)}`;
}

export function flatsPaidLabel(apartment) {
  return `${getFlatsMenuLabel(apartment)} Paid`;
}

export function flatsPendingLabel(apartment) {
  return `${getFlatsMenuLabel(apartment)} Pending`;
}

export function addFlatLabel(apartment) {
  const label = getFlatsMenuLabel(apartment);
  return label === DEFAULT_FLATS_LABEL ? 'Add Flat' : `Add ${label}`;
}

export function editFlatLabel(apartment) {
  const label = getFlatsMenuLabel(apartment);
  return label === DEFAULT_FLATS_LABEL ? 'Edit Flat' : `Edit ${label}`;
}

export function addNewFlatLabel(apartment) {
  const label = getFlatsMenuLabel(apartment);
  return label === DEFAULT_FLATS_LABEL ? 'Add New Flat' : `Add New ${label}`;
}

export function totalCountFlatsLabel(apartment, count) {
  return `${count} total ${flatsLabelLower(apartment)}`;
}

export function manageFlatsSubtitle(apartment) {
  return `Manage ${flatsLabelLower(apartment)} for the selected apartment`;
}

export function noFlatsAddedTitle(apartment) {
  return `No ${flatsLabelLower(apartment)} added yet`;
}

export function noFlatsMatchMessage(apartment, searchTerm) {
  return `No ${flatsLabelLower(apartment)} match "${searchTerm}"`;
}

export function noFlatsFoundTitle(apartment) {
  return `No ${flatsLabelLower(apartment)} found`;
}

export function searchByFlatNumberPlaceholder(apartment) {
  return `Search by ${flatsUnitSingular(apartment)} number or owner...`;
}

export function searchByFlatOrOwnerPlaceholder(apartment) {
  return `Search by ${flatsUnitSingular(apartment)} or owner...`;
}

export function deleteFlatTitle(apartment) {
  const label = getFlatsMenuLabel(apartment);
  return label === DEFAULT_FLATS_LABEL ? 'Delete flat?' : `Delete ${label.toLowerCase()}?`;
}

export function deleteFlatMessage(apartment, flatNumber) {
  return `Are you sure you want to delete ${flatNumber || ''}?`;
}

export function thisUnitLabel(apartment) {
  const label = getFlatsMenuLabel(apartment);
  if (label === DEFAULT_FLATS_LABEL) return 'This Flat';
  return `This ${label.replace(/s$/i, '')}`;
}

export function unitWithNumber(apartment, flatNumber) {
  if (!flatNumber) return thisUnitLabel(apartment);
  return String(flatNumber);
}

export function selectFlatForMaintenanceToast(apartment, maintenanceLabel) {
  return `Select a ${flatsUnitSingular(apartment)} for ${maintenanceLabel.toLowerCase()} payments`;
}

export function isMaintenanceCategory(category) {
  return String(category || '').trim().toLowerCase() === MAINTENANCE_CATEGORY_VALUE.toLowerCase();
}

/** Display label for income/expense categories (Maintenance → custom name). */
export function formatCategoryLabel(apartment, category) {
  if (isMaintenanceCategory(category)) return getMaintenanceMenuLabel(apartment);
  return category || '—';
}

export function totalMaintenanceCollectedLabel(apartment) {
  return `Total ${getMaintenanceMenuLabel(apartment).toLowerCase()} collected`;
}

export function pendingMaintenanceLabel(apartment) {
  return `Pending ${getMaintenanceMenuLabel(apartment).toLowerCase()}`;
}

export function maintenanceMonthColumnLabel(apartment) {
  return `${getMaintenanceMenuLabel(apartment)} Month`;
}

export function maintenanceAmountLabel(apartment) {
  return `${getMaintenanceMenuLabel(apartment)} amount`;
}

export function bulkMaintenanceCollectionLabel(apartment) {
  return `Bulk ${getMaintenanceMenuLabel(apartment)} Collection`;
}

export function applyMaintenancePaymentToLabel(apartment) {
  return `Apply ${getMaintenanceMenuLabel(apartment).toLowerCase()} payment to`;
}

export function showMaintenanceViewerLabel(apartment) {
  return `Show ${getMaintenanceMenuLabel(apartment).toLowerCase()}`;
}

export function maintenanceViewerHelpLabel(apartment) {
  return `Allow viewing ${getMaintenanceMenuLabel(apartment).toLowerCase()} status for this apartment`;
}

export function maintenanceTabReference(apartment) {
  return getMaintenanceMenuLabel(apartment);
}

export function maintenanceCategoryOption(apartment) {
  return { value: MAINTENANCE_CATEGORY_VALUE, label: getMaintenanceMenuLabel(apartment) };
}

export function normalizeMenuLabelInput(value) {
  return String(value ?? '').trim().slice(0, MAX_MENU_LABEL_LENGTH);
}

export function menuLabelForSave(value) {
  const trimmed = normalizeMenuLabelInput(value);
  return trimmed || null;
}

export { DEFAULT_FLATS_LABEL, DEFAULT_MAINTENANCE_LABEL, MAX_MENU_LABEL_LENGTH };
