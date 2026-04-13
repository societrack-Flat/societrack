import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowLeft, CreditCard, Shield, Zap } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getAllPlans, initiatePayment } from '../lib/razorpay';
import Button from '../components/Button';
import Card from '../components/Card';
import toast from 'react-hot-toast';

const Subscribe = () => {
  const [selectedPlan, setSelectedPlan] = useState('standard');
  const [loading, setLoading] = useState(false);
  const { apartment, userProfile, updateSubscription, checkSubscription } = useAuth();
  const navigate = useNavigate();

  const plans = getAllPlans();
  const subscription = checkSubscription();

  const handleSubscribe = async () => {
    if (!apartment || !userProfile) {
      toast.error('Please login to continue');
      return;
    }

    setLoading(true);

    try {
      await initiatePayment({
        planName: selectedPlan,
        apartmentId: apartment.id,
        apartmentName: apartment.name,
        userEmail: userProfile.email,
        userName: userProfile.name,
        userPhone: userProfile.phone,
        onSuccess: async (paymentData) => {
          const result = await updateSubscription(selectedPlan, paymentData);
          if (result.success) {
            toast.success('Subscription activated successfully!');
            navigate('/admin/dashboard');
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

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/admin/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Trial expired notice */}
        {subscription.reason === 'expired' && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-red-900 mb-2">Your trial has expired</h3>
            <p className="text-red-700">
              Subscribe to continue using Societrack and keep your apartment finances organized.
            </p>
          </div>
        )}

        {/* Page Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900">Choose Your Plan</h1>
          <p className="mt-4 text-xl text-gray-600">
            Select a plan that fits your apartment community size
          </p>
          {apartment && (
            <p className="mt-2 text-sm text-gray-500">
              Current apartment: <span className="font-medium">{apartment.name}</span>
            </p>
          )}
        </div>

        {/* Features Banner */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Shield className="text-green-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secure & Reliable</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Bank-level security for your financial data
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Zap className="text-blue-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Easy to Use</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Intuitive interface, no training needed
                </p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-start gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <CreditCard className="text-purple-600" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Cancel Anytime</h3>
                <p className="text-sm text-gray-600 mt-1">
                  No long-term commitment required
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Pricing Plans */}
        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative bg-white rounded-2xl p-8 cursor-pointer transition-all ${
                selectedPlan === plan.id
                  ? 'border-2 border-green-500 shadow-xl scale-105'
                  : plan.id === 'standard'
                  ? 'border-2 border-blue-500 shadow-lg'
                  : 'border border-gray-200'
              }`}
              onClick={() => setSelectedPlan(plan.id)}
            >
              {plan.id === 'standard' && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-sm font-medium px-4 py-1 rounded-full">
                  Most Popular
                </span>
              )}

              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className="text-4xl font-bold text-gray-900">
                    ₹{plan.amount / 100}
                  </span>
                  <span className="text-gray-500 ml-2">/month</span>
                </div>
                <p className="mt-2 text-gray-600">{plan.description}</p>
              </div>

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check size={20} className="text-green-500 flex-shrink-0" />
                    <span className="text-gray-600">{feature}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-center">
                {selectedPlan === plan.id ? (
                  <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                    <Check size={16} className="text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Subscribe Button */}
        <div className="max-w-md mx-auto">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            onClick={handleSubscribe}
            icon={CreditCard}
          >
            Subscribe to {plans.find(p => p.id === selectedPlan)?.name} Plan
          </Button>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
              <Shield size={16} />
              <span>Secure payment powered by Razorpay</span>
            </div>
            <p className="text-center text-xs text-gray-500">
              You will be charged ₹{plans.find(p => p.id === selectedPlan)?.amount / 100} monthly. Cancel anytime from your account settings.
            </p>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I change my plan later?</h3>
              <p className="text-gray-600">
                Yes, you can upgrade or downgrade your plan anytime from your account settings.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We accept all major credit/debit cards, UPI, net banking, and wallets through Razorpay.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Is there a setup fee?</h3>
              <p className="text-gray-600">
                No, there are no setup fees or hidden charges. You only pay the monthly subscription.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Can I get a refund?</h3>
              <p className="text-gray-600">
                Yes, we offer a 30-day money-back guarantee if you're not satisfied with our service.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
