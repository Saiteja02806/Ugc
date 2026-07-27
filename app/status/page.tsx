import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "System Status",
  description:
    "Public status and support information for UGC Pilot account connections, uploads, scheduling, and publishing.",
};

export default function StatusPage() {
  return (
    <LegalPageShell
      eyebrow="System Status"
      title="UGC Pilot status and support"
      description="Use this page for public support contacts and current operational guidance for UGC Pilot."
    >
      <div className="flex flex-col gap-8">
        <LegalSection title="Current status">
          <p>
            UGC Pilot does not currently publish a separate real-time incident
            dashboard. If uploads, account connections, scheduling, or
            publishing appear unavailable, contact support so we can investigate
            the account and connected platform involved.
          </p>
        </LegalSection>

        <LegalSection title="What to include in a support request">
          <LegalList>
            <li>The email address used for the UGC Pilot account.</li>
            <li>The connected Instagram account involved.</li>
            <li>The time the issue occurred and the post or draft affected.</li>
            <li>Any visible error message from UGC Pilot or the connected platform.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Contacts">
          <p>
            Product and publishing support:{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:support@getugcpilot.com">
              support@getugcpilot.com
            </a>
          </p>
          <p>
            Privacy or deletion requests:{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
