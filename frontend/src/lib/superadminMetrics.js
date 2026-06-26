/** Labels and helpers for Super Admin dashboards (matches subscription plans in app). */

export const PLAN_DISPLAY = {
  free_trial: 'Free',
  basic: '₹499 Plan',
  standard: '₹499 Plan',
  premium: '₹499 Plan',
};

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isSuccessPayment(p) {
  const st = String(p?.status || '').toLowerCase();
  return st === 'success' || st === 'captured' || st === 'paid';
}

function paidAmount(apt) {
  const price = Number(apt?.monthly_price || 0);
  if (price > 0) return price;
  return 499;
}

function paymentDate(apt) {
  if (apt?.subscription_end_date) {
    const end = new Date(apt.subscription_end_date);
    if (!Number.isNaN(end.getTime())) {
      return new Date(end.getFullYear(), end.getMonth() - 1, Math.min(end.getDate(), 28));
    }
  }
  const raw = apt?.updated_at || apt?.created_at;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sum all successful payments; if none recorded, estimate from active paid subscriptions. */
export function totalPlatformRevenue(payments, apartments) {
  const fromHistory = (payments || [])
    .filter(isSuccessPayment)
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  if (fromHistory > 0) return fromHistory;

  return (apartments || [])
    .filter(isPaidPlan)
    .reduce((s, a) => s + paidAmount(a), 0);
}

export function aggregatePaymentsByMonth(payments, year) {
  const months = Array(12).fill(0);
  (payments || []).forEach((p) => {
    if (!isSuccessPayment(p)) return;
    const d = new Date(p.created_at);
    if (d.getFullYear() !== year) return;
    months[d.getMonth()] += Number(p.amount || 0);
  });
  return months;
}

export function monthlyRevenueChartData(payments, year, apartments = []) {
  const values = aggregatePaymentsByMonth(payments, year);
  const hasHistory = values.some((v) => v > 0);

  if (!hasHistory && apartments?.length) {
    apartments.filter(isPaidPlan).forEach((apt) => {
      const d = paymentDate(apt);
      if (!d || d.getFullYear() !== year) return;
      values[d.getMonth()] += paidAmount(apt);
    });
  }

  return MONTHS.map((label, i) => ({ label, value: values[i] }));
}

/** Revenue per month — last 12 months (rolling). */
export function monthlyRevenueLast12Months(payments, apartments = []) {
  const now = new Date();
  const buckets = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const yr = String(d.getFullYear()).slice(-2);
    buckets.push({
      label: `${MONTHS[d.getMonth()]} '${yr}`,
      year: d.getFullYear(),
      month: d.getMonth(),
      value: 0,
    });
  }

  (payments || []).forEach((p) => {
    if (!isSuccessPayment(p)) return;
    const d = new Date(p.created_at);
    if (Number.isNaN(d.getTime())) return;
    buckets.forEach((b) => {
      if (d.getFullYear() === b.year && d.getMonth() === b.month) {
        b.value += Number(p.amount || 0);
      }
    });
  });

  const hasHistory = buckets.some((b) => b.value > 0);
  if (!hasHistory && apartments?.length) {
    apartments.filter(isPaidPlan).forEach((apt) => {
      const d = paymentDate(apt);
      if (!d) return;
      buckets.forEach((b) => {
        if (d.getFullYear() === b.year && d.getMonth() === b.month) {
          b.value += paidAmount(apt);
        }
      });
    });
  }

  return buckets.map(({ label, value }) => ({ label, value }));
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
      month: d.getMonth(),
      value: 0,
    });
  }

  (apartments || []).forEach((a) => {
    const d = new Date(a.created_at);
    if (Number.isNaN(d.getTime())) return;
    buckets.forEach((b) => {
      if (d.getFullYear() === b.year && d.getMonth() === b.month) b.value += 1;
    });
  });

  return buckets.map(({ label, value }) => ({ label, value }));
}
