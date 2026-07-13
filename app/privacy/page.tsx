import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for UGC Pilot, including social platform data, uploaded media, AI-assisted content, and data deletion.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy Policy"
      title="How UGC Pilot handles user data"
      description="This policy explains what information we process when users create, edit, schedule, and publish social marketing content through UGC Pilot."
    >
      <div className="space-y-8">
        <LegalSection title="Who we are">
          <p>
            UGC Pilot is a social video creation and scheduling platform
            operated through getugcpilot.com. Users can create marketing
            carousels and videos, upload product media, prepare social posts,
            and connect supported publishing platforms.
          </p>
          <p>
            Privacy questions can be sent to{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            . General support questions can be sent to{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:support@getugcpilot.com">
              support@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Information we collect">
          <LegalList>
            <li>
              Account information, such as name, email address, authentication
              details, workspace information, and account identifiers.
            </li>
            <li>
              Connected social account information, such as TikTok, Instagram,
              YouTube, or other supported platform account IDs, profile
              information returned by OAuth, access tokens, and refresh tokens.
            </li>
            <li>
              Content information, such as uploaded videos, app recordings,
              product demos, screen recordings, images, captions, hashtags,
              titles, thumbnails, scheduled post times, publishing settings,
              post status, and publishing logs.
            </li>
            <li>
              AI-assisted content information, such as user instructions,
              uploaded media used for generation or editing, generated outputs,
              selected assets, and whether particular content requires an
              AI-generated content disclosure.
            </li>
            <li>
              Rights and disclosure confirmations, such as commercial content
              disclosures, sponsored content settings, music or license
              confirmations, and user confirmations that they have permission to
              use the content they publish.
            </li>
            <li>
              Technical information, such as IP address, device and browser
              information, cookies, analytics events, logs, and error reports.
            </li>
          </LegalList>
        </LegalSection>

        <LegalSection title="How we use information">
          <LegalList>
            <li>Create and secure user accounts.</li>
            <li>Analyze business profile information to help generate content ideas.</li>
            <li>Store drafts, uploaded media, generated content, and scheduled posts.</li>
            <li>Connect social accounts at the user request.</li>
            <li>Upload, schedule, publish, and track post status when a user approves it.</li>
            <li>Show connected account names, publishing settings, and post history.</li>
            <li>Troubleshoot failed uploads, rendering jobs, publishing jobs, or account connections.</li>
            <li>Detect abuse, protect the service, and comply with legal and platform requirements.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Connected social platforms">
          <p>
            When a user connects TikTok, Instagram, YouTube, or another
            supported platform, we use the connected account data only to provide
            the user-requested creation, scheduling, publishing, status, and
            account-management features.
          </p>
          <p>
            We do not sell TikTok, Instagram, or YouTube account data. We do not
            publish posts to connected accounts without the user reviewing and
            approving the post or schedule.
          </p>
          <p>
            UGC Pilot uses YouTube API Services when a user connects YouTube.
            Google privacy practices are described in the{" "}
            <a
              className="font-bold text-[#c2410c]"
              href="https://policies.google.com/privacy"
              rel="noreferrer"
              target="_blank"
            >
              Google Privacy Policy
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Access tokens and account permissions">
          <p>
            We may store access tokens and refresh tokens securely so users can
            schedule and publish content. Users can disconnect a connected
            account at any time. When a user disconnects an account, we delete
            or revoke stored tokens where technically possible.
          </p>
          <p>
            For YouTube, users can also manage third-party access from Google
            security settings at{" "}
            <a
              className="font-bold text-[#c2410c]"
              href="https://security.google.com/settings/security/permissions"
              rel="noreferrer"
              target="_blank"
            >
              https://security.google.com/settings/security/permissions
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Uploaded media and generated content">
          <p>
            We store uploaded or selected media so users can create drafts,
            generate or edit content, schedule posts, and publish at the selected
            time. Users can delete drafts, uploaded media, scheduled posts, or
            their account.
          </p>
          <p>
            Uploaded media is deleted within 30 days after account deletion
            unless limited records must be retained for security, fraud
            prevention, billing, legal compliance, or dispute resolution.
          </p>
        </LegalSection>

        <LegalSection title="AI-assisted content">
          <p>
            UGC Pilot provides AI-assisted video generation and editing
            features. Users may use these features to generate, modify, or
            prepare video content for publishing.
          </p>
          <p>
            We may process and store information associated with this
            functionality, including user instructions, uploaded media,
            generated outputs, selected assets, and whether particular content
            requires an AI-generated content disclosure.
          </p>
          <p>
            When a user chooses to publish content through a supported social
            platform, we may transmit the applicable AI-generated content
            indicator and other publishing settings required by that platform.
          </p>
        </LegalSection>

        <LegalSection title="Information sharing">
          <p>
            We share information only as needed to provide the service, follow
            user instructions, operate the product, and comply with law or
            platform requirements.
          </p>
          <LegalList>
            <li>TikTok, when the user connects or publishes to TikTok.</li>
            <li>Meta and Instagram, when the user connects or publishes to Instagram.</li>
            <li>YouTube and Google, when the user connects or publishes to YouTube.</li>
            <li>Cloud hosting, database, storage, email, analytics, error monitoring, and payment providers.</li>
            <li>Law enforcement, regulators, or legal requesters when required by applicable law.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Cookies and analytics">
          <p>
            We may use cookies and analytics tools to keep users signed in,
            remember preferences, improve product performance, measure usage,
            debug errors, and detect abuse.
          </p>
        </LegalSection>

        <LegalSection title="Data deletion and retention">
          <p>
            Users can request deletion by using product settings where available
            or by emailing{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            . Data deletion instructions are available at{" "}
            <a className="font-bold text-[#c2410c]" href="https://getugcpilot.com/data-deletion">
              https://getugcpilot.com/data-deletion
            </a>
            .
          </p>
          <p>
            For YouTube API data, when a user asks us to delete stored
            YouTube-related data or deletes their UGC Pilot account, we delete
            that data as soon as possible and within 7 calendar days unless
            retention is required by law. When a user revokes access through the
            Google security settings page, we delete associated YouTube API data
            as soon as possible and within 30 calendar days.
          </p>
        </LegalSection>

        <LegalSection title="Security">
          <p>
            We use HTTPS, access controls, restricted internal access, secure
            token handling, and encrypted storage where appropriate to protect
            user data. No internet service can guarantee perfect security.
          </p>
        </LegalSection>

        <LegalSection title="Children">
          <p>
            UGC Pilot is not intended for children under 13 or the minimum age
            required by local law. Users may not upload or generate content that
            exploits minors or violates platform child-safety rules.
          </p>
        </LegalSection>

        <LegalSection title="User rights">
          <p>
            Users may request access, correction, deletion, export, or
            restriction of their personal data by contacting{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="Policy updates">
          <p>
            We may update this Privacy Policy from time to time. The updated
            version will be posted on this page with a new effective date.
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
