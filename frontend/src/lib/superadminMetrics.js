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

export function aggregatePaymentsByMonth(payments, year) {
  const months = Array(12).fill(0);
  (payments || []).forEach((p) => {
    if (String(p.status || '').toLowerCase() !== 'success') return;
    const d = new Date(p.created_at);
    if (d.getFullYear() !== year) return;
    months[d.getMonth()] += Number(p.amount || 0);
  });
  return months;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthlyRevenueChartData(payments, year) {
  const values = aggregatePaymentsByMonth(payments, year);
  return MONTHS.map((label, i) => ({ label, value: values[i] }));
}
