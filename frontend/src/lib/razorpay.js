import { flushSync } from 'react-dom';
import { paymentsApi } from './apiClient';

/** Must match backend `app/subscription_plans.PLAN_ID` */
export const SOCIETRACK_PLAN_ID = 'societrack_pro';

const PLANS = {
  [SOCIETRACK_PLAN_ID]: {
    name: 'Societrack Pro',
    amount: 49900, // paise
    flatLimit: 500,
    description: 'Full access to apartments, reports, income & expense tracking, maintenance, and more.',
    features: [
      'Unlimited data entry and updates',
      'All reports and exports',
      'Maintenance & announcements',
      'Email support',
    ],
  },
};

let razorpayScriptPromise = null;

/** `Subscribe` → `/pay-razorpay` handoff (JSON: order, plan, prefill; no functions). */
export const RAZORPAY_CHECKOUT_SESSION_KEY = 'societrack_rzp_checkout_v1';

/**
 * Defer open() past React commit + token refresh; avoids blank Razorpay Checkout v2 when refresh_token runs.
 * Same pattern as setTimeout(0) + double requestAnimationFrame.
 */
export function openRazorpayDeferred(razorpay, onOpenError) {
  const open = () => {
    try {
      razorpay.open();
    } catch (e) {
      const err = e instanceof Error ? e : new Error('Could not open Razorpay checkout');
      onOpenError?.(err);
    }
  };
  window.setTimeout(() => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(open);
      });
    } else {
      open();
    }
  }, 0);
}

export function loadRazorpayScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Razorpay is only available in the browser'));
  }
  if (window.Razorpay) {
    return Promise.resolve();
  }
  if (razorpayScriptPromise) {
    return razorpayScriptPromise;
  }
  razorpayScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Razorpay checkout script'));
    document.body.appendChild(s);
  });
  return razorpayScriptPromise;
}

export const getPlanDetails = (planId) => PLANS[planId] || PLANS[SOCIETRACK_PLAN_ID];

export const getAllPlans = () => {
  return Object.entries(PLANS).map(([id, value]) => ({
    id,
    ...value,
  }));
};

/**
 * Open Razorpay: creates order on server, then Standard Checkout.
 */
export const initiatePayment = ({
  planId = SOCIETRACK_PLAN_ID,
  apartmentId,
  apartmentName,
  userEmail,
  userName,
  userPhone,
  onSuccess,
  onFailure,
  /**
   * Called as soon as the server order is ready (before Razorpay UI opens). Use to clear button loading; avoids
   * a stuck spinner if open() is delayed, blocked, or user-gesture issues after async gaps.
   */
  onOrderReady,
  /** @deprecated use onOrderReady; still called right before open() for backward compatibility. */
  onCheckoutOpen,
}) => {
  return new Promise((resolve, reject) => {
    const go = async () => {
      try {
        await loadRazorpayScript();
        if (!window.Razorpay) {
          throw new Error('Razorpay failed to load');
        }

        const order = await paymentsApi.createRazorpayOrder({
          plan_id: planId,
          apartment_id: apartmentId,
        });

        const plan = getPlanDetails(planId);
        const key = order.key_id;
        if (!key || !order.order_id) {
          throw new Error('Invalid order response from server');
        }

        if (onOrderReady) {
          try {
            // Flush so the Pay button / route shell update before open(); avoids a stuck "Loading" UI
            // and auth trees that re-render in the same tick as Razorpay.
            flushSync(() => onOrderReady());
          } catch {
            /* ignore */
          }
        }

        const amt = Number(order.amount);
        if (!Number.isFinite(amt) || amt <= 0) {
          throw new Error('Invalid order amount from server');
        }

        const logo = typeof window !== 'undefined' ? `${window.location.origin}/societrack-logo.png` : null;

        const options = {
          key,
          order_id: order.order_id,
          amount: amt,
          currency: (order.currency || 'INR').toUpperCase(),
          name: 'Societrack',
          description: `${plan.name} — monthly access`,
          ...(logo ? { image: logo } : {}),
          handler: function (response) {
            const paymentData = {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId,
              amount: plan.amount / 100,
              apartment_id: apartmentId,
            };
            onSuccess?.(paymentData);
            resolve(paymentData);
          },
          prefill: {
            name: userName || '',
            email: userEmail || '',
            contact: userPhone || '',
          },
          notes: {
            apartment_id: apartmentId,
            apartment_name: apartmentName,
            plan_id: planId,
          },
          theme: { color: '#22c55e' },
          modal: {
            ondismiss: function () {
              const error = new Error('Payment cancelled by user');
              onFailure?.(error);
              reject(error);
            },
          },
        };

        const razorpay = new window.Razorpay(options);
        razorpay.on('payment.failed', function (response) {
          const error = new Error(response.error?.description || 'Payment failed');
          error.code = response.error?.code;
          onFailure?.(error);
          reject(error);
        });
        try {
          onCheckoutOpen?.();
        } catch {
          /* ignore */
        }
        openRazorpayDeferred(razorpay, (err) => {
          onFailure?.(err);
          reject(err);
        });
      } catch (error) {
        onFailure?.(error);
        reject(error);
      }
    };

    go();
  });
};

export const createSubscription = (params) => initiatePayment(params);

export const verifyPayment = async (paymentData) => {
  const { razorpay_payment_id } = paymentData;
  if (!razorpay_payment_id) {
    throw new Error('Invalid payment data');
  }
  return true;
};

export default {
  getPlanDetails,
  getAllPlans,
  initiatePayment,
  createSubscription,
  verifyPayment,
  openRazorpayDeferred,
  SOCIETRACK_PLAN_ID,
};
