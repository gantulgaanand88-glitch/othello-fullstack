import { Link } from 'react-router-dom';

export function PrivacyPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <section className="space-y-6 rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 text-gray-300">
        <div>
          <h2 className="text-xl font-semibold text-white">1. What Data We Collect</h2>
          <p className="mt-3 leading-relaxed">
            We collect the minimum data necessary to operate Othello Arena:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm">
            <li><strong className="text-white">Account information:</strong> email address and username (registered users only).</li>
            <li><strong className="text-white">Game history:</strong> moves, results, ratings, and timestamps for every game played.</li>
            <li><strong className="text-white">IP address:</strong> temporarily logged for rate-limiting and abuse prevention. Not stored long-term.</li>
            <li><strong className="text-white">Authentication token:</strong> a JSON Web Token (JWT) stored in your browser&apos;s localStorage.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">2. How We Use Your Data</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm">
            <li><strong className="text-white">Matchmaking:</strong> pairing players by rating for fair matches.</li>
            <li><strong className="text-white">Leaderboard:</strong> displaying public rankings of registered players.</li>
            <li><strong className="text-white">Account security:</strong> verifying identity and preventing abuse.</li>
            <li><strong className="text-white">Game history:</strong> recording matches so you can review past games.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">3. Data Retention</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Game records are kept indefinitely for leaderboard integrity. You may delete your account at any time, which removes your personal data (email, username, authentication credentials). Anonymized game records may be retained for statistical purposes.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">4. Third Parties</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Othello Arena does <strong className="text-white">not</strong> share data with third parties. We use no analytics services, no advertising networks, and no tracking pixels. Your data stays on our servers.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">5. Your Rights (GDPR)</h2>
          <p className="mt-3 text-sm leading-relaxed">
            If you are a resident of the European Economic Area, you have the following rights:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm">
            <li><strong className="text-white">Access:</strong> request a copy of all data we hold about you.</li>
            <li><strong className="text-white">Rectification:</strong> correct inaccurate personal information.</li>
            <li><strong className="text-white">Deletion:</strong> request deletion of your account and associated data.</li>
            <li><strong className="text-white">Export:</strong> download your data in a machine-readable format (JSON).</li>
            <li><strong className="text-white">Restriction:</strong> request that we restrict processing of your data.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">6. Exercising Your Rights</h2>
          <p className="mt-3 text-sm leading-relaxed">
            You can exercise your data rights through the Account Settings page in your profile. Use the &quot;Download My Data&quot; button to export, or the &quot;Delete My Account&quot; button to remove your data.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">7. Contact</h2>
          <p className="mt-3 text-sm leading-relaxed">
            For privacy-related inquiries, please contact us via the in-app feedback form or by creating a support request through your account settings.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">8. Cookies &amp; Local Storage</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Othello Arena uses only <strong className="text-white">essential cookies and localStorage</strong>. Specifically, we store a JWT authentication token and cookie-consent preference in localStorage. We do not use tracking cookies, analytics cookies, or any third-party cookies.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">9. Children&apos;s Privacy</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Othello Arena is intended for users aged 13 and older, in compliance with COPPA. We do not knowingly collect personal information from children under 13. If you believe a child under 13 has created an account, please contact us so we can delete it promptly.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">10. Changes to This Policy</h2>
          <p className="mt-3 text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. Registered users will be notified of significant changes via email. Continued use of the service after changes constitutes acceptance of the updated policy.
          </p>
        </div>
      </section>

      <div className="flex justify-center pb-8">
        <Link
          to="/"
          className="text-sm font-medium text-green-400 transition hover:text-green-300"
        >
          ← Back to Home
        </Link>
      </div>
    </article>
  );
}

export default PrivacyPolicyPage;
