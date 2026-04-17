const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID;

const PLANS = {
  basic: {
    name: 'Basic',
    amount: 19900, // Amount in paise (₹199)
    flatLimit: 50,
    description: 'Perfect for small apartments',
    features: ['Up to 50 flats', 'Basic reports', 'Email support'],
  },
  standard: {
    name: 'Standard',
    amount: 29900, // Amount in paise (₹299)
    flatLimit: 100,
    description: 'Great for medium-sized societies',
    features: ['Up to 100 flats', 'Advanced reports', 'Priority support', 'Bulk operations'],
  },
  premium: {
    name: 'Premium',
    amount: 39900, // Amount in paise (₹399)
    flatLimit: 500,
    description: 'For large apartment complexes',
    features: ['Up to 500 flats', 'All reports', '24/7 support', 'API access', 'Custom branding'],
  },
};

export const getPlanDetails = (planName) => {
  return PLANS[planName] || PLANS.basic;
};

export const getAllPlans = () => {
  return Object.entries(PLANS).map(([key, value]) => ({
    id: key,
    ...value,
  }));
};

export const initiatePayment = ({
  planName,
  apartmentId,
  apartmentName,
  userEmail,
  userName,
  userPhone,
  onSuccess,
  onFailure,
}) => {
  return new Promise((resolve, reject) => {
    if (!RAZORPAY_KEY_ID) {
      const error = new Error('Razorpay key not configured');
      onFailure?.(error);
      reject(error);
      return;
    }

    const plan = getPlanDetails(planName);
    
    const options = {
      key: RAZORPAY_KEY_ID,
      amount: plan.amount,
      currency: 'INR',
      name: 'Societrack',
      description: `${plan.name} Plan - Monthly Subscription`,
      image: '/societrack-logo.png',
      handler: function (response) {
        const paymentData = {
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_order_id: response.razorpay_order_id,
          razorpay_signature: response.razorpay_signature,
          plan_name: planName,
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
        plan_name: planName,
      },
      theme: {
        color: '#22c55e',
      },
      modal: {
        ondismiss: function () {
          const error = new Error('Payment cancelled by user');
          onFailure?.(error);
          reject(error);
        },
      },
    };

    try {
      const razorpay = new window.Razorpay(options);
      razorpay.on('payment.failed', function (response) {
        const error = new Error(response.error.description || 'Payment failed');
        error.code = response.error.code;
        error.reason = response.error.reason;
        onFailure?.(error);
        reject(error);
      });
      razorpay.open();
    } catch (error) {
      onFailure?.(error);
      reject(error);
    }
  });
};

export const createSubscription = async ({
  planName,
  apartmentId,
  apartmentName,
  userEmail,
  userName,
  userPhone,
  onSuccess,
  onFailure,
}) => {
  // For subscription-based billing, you would typically:
  // 1. Create a subscription on your backend using Razorpay Subscriptions API
  // 2. Return the subscription ID to the frontend
  // 3. Use the subscription ID to process recurring payments
  
  // For simplicity, we're using one-time payments here
  // You can modify this to use Razorpay Subscriptions API
  
  return initiatePayment({
    planName,
    apartmentId,
    apartmentName,
    userEmail,
    userName,
    userPhone,
    onSuccess,
    onFailure,
  });
};

export const verifyPayment = async (paymentData) => {
  // In a production environment, you should verify the payment signature
  // on your backend using Razorpay's verification method
  
  // For now, we'll assume the payment is valid if we have all required fields
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = paymentData;
  
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
};