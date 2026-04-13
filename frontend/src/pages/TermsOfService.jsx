import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService = () => (
  <div className="min-h-screen bg-slate-50 py-10 px-4">
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
      <Link to="/" className="text-sm text-emerald-600 hover:text-emerald-800 font-medium mb-6 inline-block">
        ← Back to home
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms &amp; Conditions – Societrack</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: April 12, 2026</p>

      <div className="prose prose-slate max-w-none text-gray-700 space-y-6 text-sm leading-relaxed">
        <p>
          By accessing or using Societrack, you agree to the following Terms &amp; Conditions.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">1. Acceptance of Terms</h2>
          <p>
            By using our application or website, you agree to comply with these terms. If you do not agree, please do not use the platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">2. Description of Services</h2>
          <p>Societrack provides a platform for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Society maintenance tracking</li>
            <li>Income and expense management</li>
            <li>Uploading bills and financial records</li>
            <li>Viewing reports for admins and residents</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">3. User Responsibilities</h2>
          <p>Users agree to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Provide accurate and complete information</li>
            <li>Use the platform only for lawful purposes</li>
            <li>Not misuse or attempt to disrupt the service</li>
            <li>Not upload false, misleading, or illegal content</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">4. Admin Responsibilities</h2>
          <p>Society administrators are responsible for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Accuracy of financial data entered</li>
            <li>Validity of uploaded bills and records</li>
            <li>Managing access for residents</li>
          </ul>
          <p className="mt-2">Societrack does not verify or audit the data entered.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">5. Data Ownership</h2>
          <p>
            All data entered into Societrack belongs to the respective society. Societrack only provides the platform to manage and display such data.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">6. Limitation of Liability</h2>
          <p>Societrack is not responsible for:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Financial decisions made by users</li>
            <li>Disputes between society members</li>
            <li>Errors in data entered by users</li>
          </ul>
          <p className="mt-2">Use of the platform is at your own risk.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">7. Subscription, Payments, Refund &amp; Cancellation</h2>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Societrack may charge a subscription fee for access to its services.</li>
            <li>Pricing may change from time to time with prior notice.</li>
          </ul>
          <p className="mt-4 font-medium">Payments</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>All payments must be made in advance to access the service.</li>
          </ul>
          <p className="mt-4 font-medium">Refund Policy</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>All payments made are non-refundable.</li>
            <li>No partial or full refunds will be provided for unused periods or early discontinuation of service.</li>
          </ul>
          <p className="mt-4 font-medium">Cancellation Policy</p>
          <ul className="list-disc pl-5 space-y-1 mt-1">
            <li>Users may stop using the service at any time.</li>
            <li>Cancellation will not entitle you to any refund.</li>
            <li>Access to services will continue until the end of the paid subscription period (if applicable).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">8. Termination</h2>
          <p>We reserve the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Suspend or terminate accounts for misuse</li>
            <li>Restrict access if terms are violated</li>
          </ul>
          <p className="mt-2">Users may discontinue use at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">9. Changes to Terms</h2>
          <p>
            We may update these Terms &amp; Conditions from time to time. Continued use of the platform indicates acceptance of updated terms.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">10. Governing Law</h2>
          <p>These terms are governed by the laws of India.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">11. Contact Information</h2>
          <p>
            Email: <a href="mailto:support@societrack.com" className="text-emerald-600 hover:underline">support@societrack.com</a>
            <br />
            Phone: 8142112121
          </p>
        </section>

        <p className="pt-6 text-gray-600 border-t border-gray-100">
          Societrack aims to provide a simple and transparent solution for society financial management. However, responsibility for data accuracy lies with the users.
        </p>
      </div>
    </div>
  </div>
);

export default TermsOfService;
