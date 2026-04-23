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

function loadRazorpayScript() {
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
  /** Called when Razorpay window opens (order created OK). Use to clear button loading — the main Promise still resolves on pay/cancel. */
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

        const options = {
          key,
          order_id: order.order_id,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: 'Societrack',
          description: `${plan.name} — monthly access`,
          image: '/societrack-logo.png',
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
        razorpay.open();
        try {
          onCheckoutOpen?.();
        } catch {
          /* ignore */
        }
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
  SOCIETRACK_PLAN_ID,
};
