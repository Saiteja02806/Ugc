import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use Policy",
  description:
    "Acceptable Use Policy for UGC Pilot, including content rights, AI disclosure, impersonation, spam, and platform compliance rules.",
};

export default function AcceptableUsePage() {
  return (
    <LegalPageShell
      eyebrow="Acceptable Use Policy"
      title="Responsible use of UGC Pilot"
      description="This policy explains what users may and may not create, upload, schedule, or publish through UGC Pilot."
    >
      <div className="flex flex-col gap-8">
        <LegalSection title="User control and platform rules">
          <p>
            UGC Pilot is designed for user-controlled Instagram content
            creation and scheduling. Users must review every carousel slide,
            image, video, caption, destination Instagram account, schedule,
            rights confirmation, and disclosure before publishing or scheduling
            content.
          </p>
          <p>
            Users are responsible for following the terms, advertising rules,
            disclosure rules, and community guidelines of Instagram.
          </p>
        </LegalSection>

        <LegalSection title="Content rights">
          <p>
            Users must own or have permission to use all videos, images, music,
            sounds, voices, likenesses, logos, product materials, screenshots,
            captions, and other assets they upload, generate, edit, schedule, or
            publish through UGC Pilot.
          </p>
          <LegalList>
            <li>Confirm ownership or permission before publishing.</li>
            <li>Use licensed music, voice, and visual assets only as allowed.</li>
            <li>
              Do not upload copyrighted content, private information, or third
              party brand assets without authorization.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="AI-assisted content and disclosures">
          <p>
            UGC Pilot may automatically prepare AI-assisted carousel slides,
            videos, images, captions, and other Instagram creative assets. Users
            are responsible for reviewing generated outputs and disclosing
            AI-generated, sponsored, commercial, or branded content where
            required by law or Instagram policy.
          </p>
          <LegalList>
            <li>Do not create deceptive testimonials or fake endorsements.</li>
            <li>Do not impersonate people, brands, or public figures.</li>
            <li>
              Do not clone or use a person&apos;s face, likeness, or voice
              without authorization.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Prohibited activity">
          <LegalList>
            <li>Spam, scams, phishing, malware, or unauthorized automation.</li>
            <li>
              Fake engagement, bulk posting abuse, Instagram manipulation, or
              deceptive traffic.
            </li>
            <li>Harassment, hate, exploitation, adult abuse, or illegal content.</li>
            <li>
              Content that violates Instagram&apos;s rules or applicable law.
            </li>
            <li>
              Attempts to bypass account authorization, rate limits, security
              controls, or disclosure requirements.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Enforcement">
          <p>
            We may limit, suspend, or remove access to publishing features when
            content or account activity appears to violate this policy, our
            Terms of Service, Instagram&apos;s rules, or applicable law.
          </p>
          <p>
            To report abuse or a rights concern, contact{" "}
            <a className="font-bold text-primary" href="mailto:support@getugcpilot.com">
              support@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
