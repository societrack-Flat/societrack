import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, CreditCard, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllPlans, initiatePayment, SOCIETRACK_PLAN_ID } from '../lib/razorpay';
import Button from '../components/Button';
import Card from '../components/Card';
import toast from 'react-hot-toast';

const Subscribe = () => {
  const [loading, setLoading] = useState(false);
  const { apartment, userProfile, updateSubscription, checkSubscription } = useAuth();
  const navigate = useNavigate();

  const plans = getAllPlans();
  const plan = plans[0];
  const subscription = checkSubscription();

  const handleSubscribe = async () => {
    if (!apartment || !userProfile) {
      toast.error('Please login to continue');
      return;
    }

    setLoading(true);

    try {
      await initiatePayment({
        planId: SOCIETRACK_PLAN_ID,
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        userEmail: userProfile.email,
        userName: userProfile.name,
        userPhone: userProfile.phone,
        onSuccess: async (paymentData) => {
          const result = await updateSubscription(SOCIETRACK_PLAN_ID, paymentData);
          setLoading(false);
          if (result.success) {
            toast.success('Payment successful! Your plan is active for 30 days.');
            navigate('/admin/dashboard');
          } else {
            toast.error(result.error || 'Could not confirm payment with server');
          }
        },
        onFailure: (error) => {
          toast.error(error.message || 'Payment failed');
          setLoading(false);
        },
      });
    } catch (error) {
      toast.error(error.message || 'Something went wrong');
      setLoading(false);
    }
  };

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            type="button"
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {subscription.reason === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Access is in view-only mode</h3>
            <p className="text-red-700">
              Subscribe to add receipts, expenses, and manage your society in Societrack again. You can still read
              reports.
            </p>
          </div>
        )}

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Societrack Pro</h1>
          <p className="mt-4 text-xl text-gray-600">One plan — full access to all admin features for your society</p>
          {apartment && (
            <p className="mt-2 text-sm text-gray-500">
              Society: <span className="font-medium">{apartment.name}</span>
            </p>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-12 max-w-5xl mx-auto">
          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Shield className="text-green-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secure payments</h3>
                <p className="text-sm text-gray-600 mt-1">Processed by Razorpay (cards, UPI, net banking, wallets)</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Zap className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">45-day free trial</h3>
                <p className="text-sm text-gray-600 mt-1">New societies start with a full free trial, then Pro renews each month</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CreditCard className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">₹499 / month</h3>
                <p className="text-sm text-gray-600 mt-1">Each successful payment extends access by 30 days</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="max-w-lg mx-auto mb-12">
          <div className="bg-white rounded-2xl p-8 border-2 border-emerald-500 shadow-lg">
            <p className="text-sm font-medium text-emerald-700 text-center mb-2">Societrack Pro</p>
            <div className="text-center mb-6">
              <span className="text-4xl font-bold text-gray-900">₹{plan.amount / 100}</span>
              <span className="text-gray-500 ml-2">/ month</span>
            </div>
            <p className="text-gray-600 text-center text-sm mb-6">{plan.description}</p>
            <ul className="space-y-3 mb-8">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="flex items-center gap-3 text-gray-700">
                  <Check size={20} className="text-emerald-500 flex-shrink-0" />
                  <span className="text-sm">{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onClick={handleSubscribe}
            icon={CreditCard}
          >
            Pay ₹{plan.amount / 100} with Razorpay
          </Button>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Shield size={16} />
              <span>Secure payment powered by Razorpay</span>
            </div>
            <p className="text-center text-xs text-gray-500">
              Your payment is verified on our server before the plan is activated. Use Test keys in the Razorpay
              dashboard while testing.
            </p>
          </div>
        </div>

        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">Questions</h2>
          <div className="space-y-6 text-sm text-gray-600">
            <p>
              <span className="font-semibold text-gray-900">What happens after 45 free days? </span>
              You’ll need an active Pro subscription to keep editing data. You’ll see a reminder 1–2 days before
              trial or billing period ends.
            </p>
            <p>
              <span className="font-semibold text-gray-900">Recurring / auto-debit? </span>
              This flow charges once per month when you pay. True auto-debit (mandates) can be added with Razorpay
              Subscriptions in a follow-up.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
