import React from 'react';
import { Link } from 'react-router-dom';

const PrivacyPolicy = () => (
  <div className="min-h-screen bg-slate-50 py-10 px-4">
    <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-8 md:p-10">
      <Link to="/" className="text-sm text-emerald-600 hover:text-emerald-800 font-medium mb-6 inline-block">
        ← Back to home
      </Link>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy – Societrack</h1>
      <p className="text-sm text-gray-500 mb-8">Effective Date: April 12, 2026</p>

      <div className="prose prose-slate max-w-none text-gray-700 space-y-6 text-sm leading-relaxed">
        <p>
          Societrack (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting the privacy of its users. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application and website.
        </p>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">1. Information We Collect</h2>
          <p>We may collect the following types of information:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li><strong>Personal Information:</strong> Name, phone number, email address</li>
            <li><strong>Society Information:</strong> Apartment name, flat details, and user role (admin/resident)</li>
            <li><strong>Financial Data:</strong> Income, expenses, maintenance records, and uploaded bills or invoices</li>
            <li><strong>Usage Data:</strong> App usage details, device information, and IP address (if applicable)</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">2. How We Use Your Information</h2>
          <p>We use the collected data to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Provide and operate our services</li>
            <li>Manage society accounting and records</li>
            <li>Improve user experience</li>
            <li>Communicate important updates and support responses</li>
            <li>Ensure platform security</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">3. Data Sharing</h2>
          <p>We do NOT sell, rent, or trade your personal data.</p>
          <p className="mt-2">We may share data only in the following cases:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>With trusted third-party service providers (such as payment gateways)</li>
            <li>If required by law or government authorities</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">4. Data Security</h2>
          <p>
            We take reasonable measures to protect your data from unauthorized access, loss, or misuse. However, no system is completely secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">5. User Rights</h2>
          <p>Users have the right to:</p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Access their personal data</li>
            <li>Request corrections</li>
            <li>Request deletion of their data</li>
          </ul>
          <p className="mt-2">To exercise these rights, please contact us using the details below.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">6. Cookies</h2>
          <p>
            Our website may use cookies to improve user experience and analyze traffic. You can disable cookies in your browser settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">7. Data Retention</h2>
          <p>
            We retain user data as long as the account is active or as required for providing services. Data may be deleted upon request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">8. Third-Party Links</h2>
          <p>
            Our platform may contain links to third-party websites. We are not responsible for their privacy practices.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">9. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. Users will be notified of significant changes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mt-8 mb-3">10. Contact Us</h2>
          <p>If you have any questions or concerns, please contact us:</p>
          <p className="mt-2">
            Email: <a href="mailto:support@societrack.com" className="text-emerald-600 hover:underline">support@societrack.com</a>
            <br />
            Phone: 8142112121
          </p>
        </section>

        <p className="pt-6 text-gray-600 border-t border-gray-100">
          Societrack is built to improve transparency in society financial management while respecting user privacy.
        </p>
      </div>
    </div>
  </div>
);

export default PrivacyPolicy;
