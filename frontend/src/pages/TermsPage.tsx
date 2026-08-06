import { Link } from 'react-router-dom';

export function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="text-sm uppercase tracking-[0.25em] text-green-400">Legal</p>
        <h1 className="mt-2 text-3xl font-bold text-white">Terms of Service</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </header>

      <section className="space-y-6 rounded-[2rem] border border-gray-800 bg-gray-800/80 p-8 text-gray-300">
        <div>
          <h2 className="text-xl font-semibold text-white">1. Acceptance of Terms</h2>
          <p className="mt-3 text-sm leading-relaxed">
            By accessing or using Othello Arena, you agree to be bound by these Terms of Service. If you do not agree, you may not use the service. These terms apply to all users, including guests and registered players.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">2. Account Rules</h2>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm">
            <li>You may create only <strong className="text-white">one account</strong> per person.</li>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>Account sharing is <strong className="text-white">not permitted</strong>.</li>
            <li>You must be at least <strong className="text-white">13 years old</strong> to create an account.</li>
            <li>Providing false information during registration may result in account termination.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">3. Code of Conduct</h2>
          <p className="mt-3 text-sm leading-relaxed">You agree to:</p>
          <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm">
            <li>Not use cheating tools, bots, or external engines to gain an unfair advantage.</li>
            <li>Not harass, abuse, or send offensive messages to other players.</li>
            <li>Not choose offensive, discriminatory, or inappropriate usernames.</li>
            <li>Not intentionally stall, delay, or abandon games to frustrate opponents.</li>
            <li>Not exploit bugs or vulnerabilities in the platform.</li>
          </ul>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">4. Fair Play Policy</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Othello Arena is committed to fair competition. We employ automated and manual systems to detect unfair play. Players found to be using engines, manipulating ratings, or colluding will have their accounts flagged. Confirmed violations result in rating adjustments, temporary suspensions, or permanent bans.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">5. Account Termination</h2>
          <p className="mt-3 text-sm leading-relaxed">
            We reserve the right to suspend or terminate accounts that violate these terms. You may also delete your own account at any time through the Account Settings page. Upon deletion, your personal data will be removed in accordance with our <Link to="/privacy" className="text-green-400 hover:text-green-300">Privacy Policy</Link>.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">6. Disclaimer of Warranties</h2>
          <p className="mt-3 text-sm leading-relaxed">
            Othello Arena is provided <strong className="text-white">&quot;as is&quot;</strong> and <strong className="text-white">&quot;as available&quot;</strong> without warranties of any kind, either express or implied. We do not guarantee uninterrupted service, error-free operation, or specific match outcomes. Maintenance windows or server issues may temporarily affect availability.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">7. Limitation of Liability</h2>
          <p className="mt-3 text-sm leading-relaxed">
            To the maximum extent permitted by applicable law, Othello Arena and its creators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the service. This includes but is not limited to loss of data, loss of rating, or service interruptions.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">8. Governing Law</h2>
          <p className="mt-3 text-sm leading-relaxed">
            These terms shall be governed by and construed in accordance with applicable laws. Any disputes arising from these terms or the service shall be resolved through good-faith negotiation before pursuing any formal legal proceedings.
          </p>
        </div>

        <div>
          <h2 className="text-xl font-semibold text-white">9. Changes to Terms</h2>
          <p className="mt-3 text-sm leading-relaxed">
            We may modify these terms at any time. Material changes will be communicated through the platform. Continued use of Othello Arena after modifications constitutes acceptance of the updated terms.
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

export default TermsPage;
