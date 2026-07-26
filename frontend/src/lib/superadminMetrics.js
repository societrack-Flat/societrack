/** Labels and helpers for Super Admin dashboards (matches subscription plans in app). */

export const PLAN_DISPLAY = {
  free_trial: 'Free',
  basic: '₹499 Plan',
  standard: '₹499 Plan',
  premium: '₹499 Plan',
};

export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MONTHS = MONTH_LABELS;

/** Single paid tier for Societrack (dashboard + subscriptions UI). */
export function planDisplayName(planName, monthlyPrice) {
  if (!planName && (monthlyPrice === 0 || monthlyPrice == null)) return 'Free';
  const p = String(planName || '').toLowerCase();
  if (p === 'free_trial' || p === 'free') return 'Free';
  const m = Number(monthlyPrice);
  if (p === 'basic' || p === 'standard' || p === 'premium') return '₹499 Plan';
  if (m === 199 || m === 299 || m === 399 || m === 499) return '₹499 Plan';
  if (!m) return 'Free';
  return `₹${m}/mo`;
}

export function isPaidPlan(apt) {
  const st = String(apt.subscription_status || '').toLowerCase();
  if (st !== 'active' && st !== 'trial') return false;
  const price = Number(apt.monthly_price || 0);
  const plan = String(apt.plan_name || '').toLowerCase();
  if (plan === 'free_trial' || plan === 'free') return false;
  return price > 0 || ['basic', 'standard', 'premium'].includes(plan);
}

export function isFreeClient(apt) {
  return !isPaidPlan(apt);
}

/** Donut: free vs single paid tier (₹499). Legacy 199/299/399 prices count as paid. */
export function planBucket(apt) {
  if (isPaidPlan(apt)) return '499';
  return 'free';
}

function isSuccessPayment(p) {
  const st = String(p?.status || '').toLowerCase();
  return st === 'success' || st === 'captured' || st === 'paid';
}

function paidAmount(apt) {
  const price = Number(apt?.monthly_price || 0);
  if (price > 0) return price;
  return 499;
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function paymentDate(apt) {
  if (apt?.subscription_end_date) {
    const end = new Date(apt.subscription_end_date);
    if (!Number.isNaN(end.getTime())) {
      return new Date(end.getFullYear(), end.getMonth() - 1, Math.min(end.getDate(), 28));
    }
  }
  return parseDate(apt?.updated_at || apt?.created_at);
}

function successfulPayments(payments) {
  return (payments || []).filter(isSuccessPayment);
}

/** Years that appear in payments or client sign-ups (newest first). */
export function availableYears(payments, apartments) {
  const years = new Set([new Date().getFullYear()]);
  successfulPayments(payments).forEach((p) => {
    const d = parseDate(p.created_at);
    if (d) years.add(d.getFullYear());
  });
  (apartments || []).forEach((a) => {
    const d = parseDate(a.created_at);
    if (d) years.add(d.getFullYear());
  });
  return [...years].sort((a, b) => b - a);
}

/** Sum all successful payments; if none recorded, estimate from active paid subscriptions. */
export function totalPlatformRevenue(payments, apartments) {
  const fromHistory = successfulPayments(payments).reduce((s, p) => s + Number(p.amount || 0), 0);
  if (fromHistory > 0) return fromHistory;

  return (apartments || [])
    .filter(isPaidPlan)
    .reduce((s, a) => s + paidAmount(a), 0);
}

/** Revenue from payment history only (accurate for charts). */
export function totalRevenueFromPayments(payments) {
  return successfulPayments(payments).reduce((s, p) => s + Number(p.amount || 0), 0);
}

export function revenueForMonth(payments, year, monthIndex) {
  return successfulPayments(payments).reduce((sum, p) => {
    const d = parseDate(p.created_at);
    if (!d || d.getFullYear() !== year || d.getMonth() !== monthIndex) return sum;
    return sum + Number(p.amount || 0);
  }, 0);
}

export function revenueForYear(payments, year) {
  return successfulPayments(payments).reduce((sum, p) => {
    const d = parseDate(p.created_at);
    if (!d || d.getFullYear() !== year) return sum;
    return sum + Number(p.amount || 0);
  }, 0);
}

export function aggregatePaymentsByMonth(payments, year) {
  const months = Array(12).fill(0);
  successfulPayments(payments).forEach((p) => {
    const d = parseDate(p.created_at);
    if (!d || d.getFullYear() !== year) return;
    months[d.getMonth()] += Number(p.amount || 0);
  });
  return months;
}

/** Monthly revenue bars for a calendar year (payment history only). */
export function monthlyRevenueChartData(payments, year) {
  const values = aggregatePaymentsByMonth(payments, year);
  return MONTHS.map((label, i) => ({
    label,
    value: values[i],
    monthIndex: i,
    year,
  }));
}

export function monthlyRevenueLast12Months(payments) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = String(d.getFullYear()).slice(-2);
    buckets.push({
      label: `${MONTHS[d.getMonth()]} '${yr}`,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      value: 0,
    });
  }

  successfulPayments(payments).forEach((p) => {
    const d = parseDate(p.created_at);
    if (!d) return;
    buckets.forEach((b) => {
      if (d.getFullYear() === b.year && d.getMonth() === b.monthIndex) {
        b.value += Number(p.amount || 0);
      }
    });
  });

  return buckets.map(({ label, value, monthIndex, year }) => ({ label, value, monthIndex, year }));
}

/** New clients per month for a calendar year. */
export function clientGrowthChartDataForYear(apartments, year) {
  const values = Array(12).fill(0);
  (apartments || []).forEach((a) => {
    const d = parseDate(a.created_at);
    if (!d || d.getFullYear() !== year) return;
    values[d.getMonth()] += 1;
  });
  return MONTHS.map((label, i) => ({
    label,
    value: values[i],
    monthIndex: i,
    year,
  }));
}

/** New clients per month — last 12 months (rolling). */
export function clientGrowthChartData(apartments) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = String(d.getFullYear()).slice(-2);
    buckets.push({
      label: `${MONTHS[d.getMonth()]} '${yr}`,
      year: d.getFullYear(),
      monthIndex: d.getMonth(),
      value: 0,
    });
  }

  (apartments || []).forEach((a) => {
    const d = parseDate(a.created_at);
    if (!d) return;
    buckets.forEach((b) => {
      if (d.getFullYear() === b.year && d.getMonth() === b.monthIndex) b.value += 1;
    });
  });

  return buckets.map(({ label, value, monthIndex, year }) => ({ label, value, monthIndex, year }));
}

export function newClientsForYear(apartments, year) {
  return (apartments || []).filter((a) => {
    const d = parseDate(a.created_at);
    return d && d.getFullYear() === year;
  }).length;
}

export function newClientsForMonth(apartments, year, monthIndex) {
  return (apartments || []).filter((a) => {
    const d = parseDate(a.created_at);
    return d && d.getFullYear() === year && d.getMonth() === monthIndex;
  }).length;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function subscriptionEndMs(apt) {
  const raw = apt.subscription_end_date || apt.trial_end_date;
  const d = parseDate(raw);
  return d ? d.getTime() : null;
}

export function countExpiringWithinDays(apartments, days = 7) {
  const now = Date.now();
  const windowMs = days * 24 * 60 * 60 * 1000;
  return (apartments || []).filter((a) => {
    const end = subscriptionEndMs(a);
    if (!end) return false;
    return end > now && end <= now + windowMs;
  }).length;
}

/** Paid subscription ended recently but status still active (grace window). */
export function countGracePeriod(apartments, graceDays = 7) {
  const now = Date.now();
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  return (apartments || []).filter((a) => {
    const end = subscriptionEndMs(a);
    if (!end || end >= now) return false;
    const st = String(a.subscription_status || '').toLowerCase();
    return now - end <= graceMs && st === 'active';
  }).length;
}

/** Expired / inactive beyond grace, or explicitly suspended. */
export function countAutoSuspended(apartments, graceDays = 7) {
  const now = Date.now();
  const graceMs = graceDays * 24 * 60 * 60 * 1000;
  return (apartments || []).filter((a) => {
    const st = String(a.subscription_status || '').toLowerCase();
    if (st === 'suspended' || st === 'expired') return true;
    const end = subscriptionEndMs(a);
    if (!end) return st === 'inactive';
    if (end >= now) return false;
    if (st === 'trial') return end < now;
    return now - end > graceMs || st === 'inactive';
  }).length;
}

/** Build summary strings for the selected year/month filter. */
export function buildPeriodRevenueSummary({ payments, year, monthFilter, apartments }) {
  const allTime = totalPlatformRevenue(payments, apartments);
  const yearTotal = revenueForYear(payments, year);
  const hasSingleMonth = monthFilter !== 'all';
  const monthIndex = hasSingleMonth ? Number(monthFilter) : null;
  const monthTotal = hasSingleMonth ? revenueForMonth(payments, year, monthIndex) : null;

  return {
    allTime,
    yearTotal,
    monthTotal,
    hasSingleMonth,
    monthLabel: hasSingleMonth ? MONTHS[monthIndex] : null,
  };
}
