import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Vidmake for support, privacy, platform review, and admin requests.",
};

export default function ContactPage() {
  return (
    <LegalPageShell
      eyebrow="Contact"
      title="Contact Vidmake"
      description="Use these contacts for product support, privacy requests, platform review, and account questions."
    >
      <div className="space-y-8">
        <LegalSection title="Support">
          <p>
            For product support, automatic carousel generation, video uploads,
            Instagram connection, scheduling, publishing, or account questions,
            contact{" "}
            <a className="font-bold text-primary" href="mailto:hello@vidmake.io">
              hello@vidmake.io
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Privacy and data deletion">
          <p>
            For privacy questions, data deletion requests, connected account
            deletion, or personal data requests, contact{" "}
            <a className="font-bold text-primary" href="mailto:privacy@vidmake.io">
              privacy@vidmake.io
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Platform review">
          <p>
            For Meta App Review, Instagram API access, or data-handling
            questions, use these contacts:
          </p>
          <LegalList>
            <li>
              Support email:{" "}
              <a className="font-bold text-primary" href="mailto:hello@vidmake.io">
                hello@vidmake.io
              </a>
            </li>
            <li>
              Developer/admin email:{" "}
              <a className="font-bold text-primary" href="mailto:admin@vidmake.io">
                admin@vidmake.io
              </a>
            </li>
          </LegalList>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
