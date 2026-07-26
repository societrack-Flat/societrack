/** Per-flat maintenance breakdown — always derived from flat fields, never hardcoded. */

export function monthIndex(year, month) {
  return year * 12 + month;
}

export function indexToYearMonth(idx) {
  const m = ((idx - 1) % 12) + 1;
  const y = Math.floor((idx - 1) / 12);
  return { year: y, month: m };
}

export function parseCreatedMonth(isoDate) {
  if (!isoDate) return null;
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** This month's recurring charge (monthly fee + other charges). */
export function currentMonthCharges(flat) {
  return (
    Number(flat?.monthly_maintenance ?? 0) +
    Number(flat?.other_maintenance ?? 0)
  );
}

/** Accumulated unpaid balance from prior closed months (live DB value). */
export function oldBalanceArrears(flat) {
  return Number(flat?.pending_maintenance ?? 0);
}

/**
 * Old balance as it was at the start of the selected month —
 * undo carries from closed months on/after that month so the filter shows correct history.
 */
export function oldBalanceAtMonthStart(flat, selectedYear, selectedMonth, closedMonthKeys) {
  let pending = oldBalanceArrears(flat);
  const selectedIdx = monthIndex(selectedYear, selectedMonth);
  const now = new Date();
  const currentIdx = monthIndex(now.getFullYear(), now.getMonth() + 1);

  for (let idx = selectedIdx; idx <= currentIdx; idx += 1) {
    const { year, month } = indexToYearMonth(idx);
    if (closedMonthKeys?.has(`${year}-${month}`)) {
      pending = Math.max(0, pending - currentMonthCharges(flat));
    }
  }

  return pending;
}

/** Total due for the current viewing period = current month + old balance. */
export function totalOutstanding(flat) {
  return currentMonthCharges(flat) + oldBalanceArrears(flat);
}

/** @deprecated use totalOutstanding — kept for imports that expect dueFromFlat name */
export function dueFromFlat(flat) {
  return totalOutstanding(flat);
}

/**
 * Build maintenance row for the selected month (paid/pending + amount breakdown).
 */
export function buildMaintenanceRowView(flat, existing, context = {}) {
  const { selectedYear, selectedMonth, closedMonthKeys } = context;
  const currentMonth = currentMonthCharges(flat);

  const hasPeriod = selectedYear && selectedMonth;
  const oldBalance = hasPeriod
    ? oldBalanceAtMonthStart(flat, selectedYear, selectedMonth, closedMonthKeys || new Set())
    : oldBalanceArrears(flat);

  if (existing?.status === 'paid') {
    const paidAmt = Number(existing.paid_amount ?? existing.amount ?? 0);
    return {
      currentMonth,
      oldBalance,
      total: paidAmt,
      amount: paidAmt,
      status: 'paid',
      paid_date: existing.paid_date ?? null,
      paid_amount: paidAmt,
    };
  }

  if (existing?.status === 'pending') {
    const raw = Number(existing.amount ?? 0);
    const total = raw > 0 ? raw : currentMonth + oldBalance;
    return {
      currentMonth,
      oldBalance,
      total,
      amount: total,
      status: 'pending',
      paid_date: existing.paid_date ?? null,
      paid_amount: Number(existing.paid_amount ?? 0),
    };
  }

  const total = currentMonth + oldBalance;
  return {
    currentMonth,
    oldBalance,
    total,
    amount: total,
    status: total > 0 ? 'pending' : 'paid',
    paid_date: null,
    paid_amount: 0,
  };
}

/**
 * Months strictly before (targetYear, targetMonth) that still need closing.
 * Start = earliest of: apartment created month, any maintenance record month (before target).
 */
export function priorMonthsNeedingClose({
  targetYear,
  targetMonth,
  maintenanceMonths,
  closedMonths,
  apartmentCreatedAt,
}) {
  const targetIdx = monthIndex(targetYear, targetMonth);
  const closedSet = new Set(
    (closedMonths || []).map((row) => `${Number(row.close_year)}-${Number(row.close_month)}`)
  );

  let earliestIdx = targetIdx;

  for (const row of maintenanceMonths || []) {
    const y = Number(row.year);
    const m = Number(row.month);
    if (!y || !m) continue;
    const idx = monthIndex(y, m);
    if (idx < targetIdx) earliestIdx = Math.min(earliestIdx, idx);
  }

  const created = parseCreatedMonth(apartmentCreatedAt);
  if (created) {
    const idx = monthIndex(created.year, created.month);
    if (idx < targetIdx) earliestIdx = Math.min(earliestIdx, idx);
  }

  if (earliestIdx >= targetIdx) {
    const prevIdx = targetIdx - 1;
    if (prevIdx < 1) return [];
    earliestIdx = prevIdx;
  }

  const months = [];
  for (let idx = earliestIdx; idx < targetIdx; idx += 1) {
    const { year, month } = indexToYearMonth(idx);
    const key = `${year}-${month}`;
    if (!closedSet.has(key)) {
      months.push({ year, month });
    }
  }

  return months;
}
