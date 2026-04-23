import React, { useLayoutEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  RAZORPAY_CHECKOUT_SESSION_KEY,
  loadRazorpayScript,
  getPlanDetails,
  openRazorpayDeferred,
} from '../lib/razorpay';
import toast from 'react-hot-toast';

/**
 * Isolated page: after create-order, we navigate here and open Standard Checkout
 * in one place with a synchronous `open()` (no React/Auth churn on the same view).
 */
const PayRazorpay = () => {
  const { updateSubscription } = useAuth();
  const navigate = useNavigate();
  const [hint, setHint] = useState('Opening secure checkout…');

  useLayoutEffect(() => {
    let cancelled = false;

    const fail = (message) => {
      toast.error(message);
      navigate('/subscribe', { replace: true });
    };

    (async () => {
      const raw = sessionStorage.getItem(RAZORPAY_CHECKOUT_SESSION_KEY);
      if (!raw) {
        fail('Payment session missing. Please try again from Subscribe.');
        return;
      }
      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        fail('Invalid payment session. Please try again from Subscribe.');
        return;
      }

      const { key_id, order_id, amount, currency, plan_id, apartment_id, apartment_name, userName, userEmail, userPhone } =
        payload;
      if (!key_id || !order_id || !plan_id || !apartment_id) {
        fail('Invalid payment session. Please try again from Subscribe.');
        return;
      }

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        fail('Invalid order amount. Please try again.');
        return;
      }

      const plan = getPlanDetails(plan_id);
      if (Number(amt) !== Number(plan.amount)) {
        fail('Order amount does not match the plan. Please subscribe again from the start.');
        return;
      }
      const logo = typeof window !== 'undefined' ? `${window.location.origin}/societrack-logo.png` : null;

      try {
        await loadRazorpayScript();
      } catch (e) {
        if (cancelled) return;
        fail(e?.message || 'Could not load Razorpay');
        return;
      }
      if (cancelled) return;
      if (!window.Razorpay) {
        fail('Razorpay is not available');
        return;
      }

      // Remove handoff only when we are about to open (StrictMode: first run may cancel
      // after await; second run still sees session until we remove here).
      sessionStorage.removeItem(RAZORPAY_CHECKOUT_SESSION_KEY);

      const options = {
        key: key_id,
        order_id,
        amount: amt,
        currency: (currency || 'INR').toUpperCase(),
        name: 'Societrack',
        description: `${plan.name} — monthly access`,
        ...(logo ? { image: logo } : {}),
        handler: function (response) {
          (async () => {
            try {
              setHint('Verifying payment…');
              const paymentData = {
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_signature: response.razorpay_signature,
                plan_id,
                amount: plan.amount / 100,
                apartment_id,
              };
              const result = await updateSubscription(plan_id, paymentData);
              if (result?.success) {
                toast.success('Payment successful! Your plan is active for 30 days.');
                navigate('/admin/dashboard', { replace: true });
              } else {
                fail(result?.error || 'Could not confirm payment with server');
              }
            } catch (e) {
              fail(e?.message || 'Could not confirm payment');
            }
          })();
        },
        prefill: {
          name: userName || '',
          email: userEmail || '',
          contact: userPhone || '',
        },
        notes: {
          apartment_id,
          apartment_name: apartment_name || '',
          plan_id: plan_id,
        },
        theme: { color: '#22c55e' },
        modal: {
          ondismiss: function () {
            toast.error('Payment cancelled');
            navigate('/subscribe', { replace: true });
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response) {
        const msg = response.error?.description || 'Payment failed';
        toast.error(msg);
        navigate('/subscribe', { replace: true });
      });
      setHint('Complete payment in the window below');
      openRazorpayDeferred(rzp, (err) => fail(err.message || 'Could not open Razorpay checkout'));
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, updateSubscription]);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <p className="text-gray-600 text-sm">{hint}</p>
    </div>
  );
};

export default PayRazorpay;
