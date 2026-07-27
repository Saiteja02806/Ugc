import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms of Service for UGC Pilot's Instagram content creation, carousel generation, video upload, scheduling, and publishing features.",
};

export default function TermsPage() {
  return (
    <LegalPageShell
      eyebrow="Terms of Service"
      title="Rules for using UGC Pilot"
      description="These terms explain how users may use UGC Pilot to create Instagram content, upload media, generate carousel posts, and schedule approved content."
    >
      <div className="space-y-8">
        <LegalSection title="Service overview">
          <p>
            UGC Pilot is a user-controlled Instagram content creation and
            scheduling tool. Users can provide business context, automatically
            prepare multi-slide carousel posts, upload or select images and
            videos, create and edit captions, review rights and disclosures,
            and approve content for scheduling or publishing to Instagram.
          </p>
        </LegalSection>

        <LegalSection title="Eligibility and user accounts">
          <p>
            Users must be old enough to use UGC Pilot under applicable law and
            able to agree to these terms for themselves or for the business they
            represent.
          </p>
          <p>
            Users are responsible for keeping account credentials secure and for
            all activity under their account. Users must provide accurate
            information and may not use UGC Pilot to access accounts they do not
            own or have permission to manage.
          </p>
        </LegalSection>

        <LegalSection title="Connected Instagram accounts">
          <p>
            Users may connect an Instagram professional account they own or are
            authorized to manage. UGC Pilot uses the connection only to provide
            the requested account selection, scheduling, publishing, status, and
            insights features.
          </p>
          <p>
            Users can disconnect Instagram through UGC Pilot Settings and
            remain responsible for following Instagram&apos;s terms, community
            guidelines, advertising rules, and other applicable policies.
          </p>
        </LegalSection>

        <LegalSection title="Content ownership and license">
          <p>
            Users keep ownership of the content they upload, create, generate,
            edit, or publish through UGC Pilot.
          </p>
          <p>
            Users grant UGC Pilot the limited permission needed to store,
            process, render, modify, schedule, transmit, and publish content
            that the user approves or asks us to process.
          </p>
        </LegalSection>

        <LegalSection title="Content rights">
          <p>
            Users are responsible for confirming that they own or have
            permission to use all content they upload, generate, select,
            schedule, or publish through UGC Pilot.
          </p>
          <LegalList>
            <li>Videos, images, captions, thumbnails, and brand assets.</li>
            <li>Music, sounds, voice recordings, and licensed media.</li>
            <li>Faces, likenesses, names, testimonials, logos, and product claims.</li>
            <li>Third-party materials included in product demos or screen recordings.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="AI and disclosure rules">
          <p>
            Users must disclose AI-generated or AI-assisted content where
            required by law, advertising rules, or Instagram policy.
          </p>
          <p>
            Users may not use UGC Pilot to impersonate people, clone a person
            without permission, create deceptive testimonials, misrepresent
            sponsored content, or bypass platform labels for AI-generated or
            commercial content.
          </p>
        </LegalSection>

        <LegalSection title="Commercial and sponsored content">
          <p>
            Users must disclose sponsored, affiliate, gifted, paid partnership,
            or commercial content where required. Users are responsible for the
            accuracy of claims about their product, offer, price, results, and
            business.
          </p>
        </LegalSection>

        <LegalSection title="Prohibited use">
          <LegalList>
            <li>Spam, scams, fake engagement, malware, or unauthorized automation.</li>
            <li>Illegal content, adult exploitation, harassment, hate, or unsafe content.</li>
            <li>Unauthorized faces, voices, music, logos, copyrighted assets, or private information.</li>
            <li>Publishing content that violates an Instagram policy.</li>
            <li>Attempting to reverse engineer, overload, or abuse UGC Pilot systems.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Publishing control">
          <p>
            UGC Pilot is designed for user-approved publishing. Users are
            expected to review carousel slides, images, videos, captions,
            disclosures, rights confirmations, the destination Instagram
            account, and the schedule before publishing.
          </p>
          <p>
            We may block, pause, or remove publishing access if content or
            account activity appears to violate these terms, platform rules, or
            applicable law.
          </p>
        </LegalSection>

        <LegalSection title="Account suspension">
          <p>
            We may suspend or limit an account, connected account access, or
            publishing features if we believe the account is being used for
            prohibited content, unauthorized account access, spam, platform
            manipulation, security abuse, non-payment, or activity that may
            violate applicable law or Instagram&apos;s rules.
          </p>
        </LegalSection>

        <LegalSection title="Payments">
          <p>
            If billing is enabled, users agree to pay the fees shown at checkout
            or in their subscription settings. Payment processing may be handled
            by a third-party payment provider.
          </p>
          <p>
            Users are responsible for managing cancellations, renewals, and
            payment-method updates through the billing controls provided in the
            product or by contacting support.
          </p>
        </LegalSection>

        <LegalSection title="Service availability">
          <p>
            UGC Pilot may change, pause, or discontinue features. Publishing
            and insights features depend on Instagram APIs, Meta approvals,
            granted permissions, rate limits, account eligibility, and platform
            availability.
          </p>
          <p>
            Scheduled posts may fail, be delayed, or require user action because
            of Instagram outages, expired permissions, account restrictions,
            unsupported formats, media-processing failures, rights or
            disclosure settings, or other Instagram requirements.
          </p>
        </LegalSection>

        <LegalSection title="Generated content and performance">
          <p>
            Automatically prepared carousel slides, captions, hooks, and other
            generated content are drafts. Users must review their accuracy,
            suitability, rights, and required disclosures before scheduling or
            publishing them.
          </p>
          <p>
            UGC Pilot does not guarantee that generated content will be approved
            by Instagram, publish successfully, or achieve any particular reach,
            engagement, sales, or other performance result.
          </p>
        </LegalSection>

        <LegalSection title="Liability">
          <p>
            To the maximum extent permitted by law, UGC Pilot is not liable for
            indirect, incidental, consequential, special, exemplary, or punitive
            damages, or for lost profits, lost revenue, lost data, failed
            publishing, delayed scheduling, account restrictions, or platform
            actions caused by third-party services or user content.
          </p>
        </LegalSection>

        <LegalSection title="Disputes">
          <p>
            Users should contact support first so we can try to resolve account,
            billing, publishing, or content disputes informally. These terms do
            not limit any rights users may have under laws that cannot be waived
            by contract.
          </p>
        </LegalSection>

        <LegalSection title="Contact">
          <p>
            Questions about these terms can be sent to{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:support@getugcpilot.com">
              support@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
