import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description:
    "Cookie Policy for UGC Pilot, including authentication, preferences, analytics, security, and user choices.",
};

export default function CookiePolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Cookie Policy"
      title="How UGC Pilot uses cookies"
      description="This policy explains how UGC Pilot uses cookies and similar technologies on getugcpilot.com."
    >
      <div className="flex flex-col gap-8">
        <LegalSection title="What cookies do">
          <p>
            Cookies and similar technologies help the site remember a browser,
            keep users signed in, protect accounts, measure usage, troubleshoot
            errors, and improve product performance.
          </p>
        </LegalSection>

        <LegalSection title="Types of cookies and similar technologies">
          <LegalList>
            <li>
              Essential cookies for sign-in, authentication, security, account
              sessions, and fraud prevention.
            </li>
            <li>
              Preference cookies for product settings, workspace state, and user
              interface choices.
            </li>
            <li>
              Analytics and performance technologies that help us understand
              product usage, errors, and reliability.
            </li>
            <li>
              Service-provider technologies used by hosting, database, storage,
              email, payment, analytics, and error-monitoring providers.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Instagram authorization">
          <p>
            When users connect Instagram, Meta or Instagram may use their own
            cookies or similar technologies during authorization, account
            connection, or visits to their services. Their own privacy and
            cookie policies apply to those services.
          </p>
        </LegalSection>

        <LegalSection title="User choices">
          <p>
            Users can control cookies through browser settings. Blocking
            essential cookies may prevent sign-in, connected account flows, or
            publishing features from working correctly.
          </p>
          <p>
            Questions about cookies or privacy can be sent to{" "}
            <a className="font-bold text-primary" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
