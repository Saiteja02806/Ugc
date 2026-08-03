import type { Metadata } from "next";

import {
  LegalList,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Privacy Policy for UGC Pilot's Instagram content creation, carousel generation, video uploads, scheduling, and publishing features.",
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell
      eyebrow="Privacy Policy"
      title="How UGC Pilot handles user data"
      description="This policy explains what information we process when users create Instagram content, upload media, generate carousel posts, and schedule approved content through UGC Pilot."
    >
      <div className="space-y-8">
        <LegalSection title="Who we are">
          <p>
            UGC Pilot is an Instagram content creation and scheduling tool
            operated through getugcpilot.com. Users can provide business
            context, automatically prepare multi-slide carousel posts, upload
            images and videos, review captions and creative assets, connect an
            Instagram professional account, and schedule approved content.
          </p>
          <p>
            Privacy questions can be sent to{" "}
            <a className="font-bold text-primary" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            . General support questions can be sent to{" "}
            <a className="font-bold text-primary" href="mailto:support@getugcpilot.com">
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
              Business profile information, such as a business name, website,
              audience, offer, brand voice, goals, and other context users
              provide to personalize content creation.
            </li>
            <li>
              Connected Instagram professional account information, such as an
              Instagram account ID, username, profile information returned
              during authorization, granted permissions, access tokens, and
              token-expiration information.
            </li>
            <li>
              Content information, such as uploaded videos, product demos,
              screen recordings, images, carousel slides, captions, titles,
              thumbnails, scheduled post times, publishing settings, post
              status, and publishing logs.
            </li>
            <li>
              Instagram media and insights information, such as media
              identifiers, media type, publishing time, reach, views,
              interactions, saves, shares, likes, comments, and other metrics
              Instagram makes available for the connected account.
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
            <li>
              Analyze business profile information to prepare personalized
              content ideas and automatic multi-slide carousel drafts.
            </li>
            <li>
              Store drafts, uploaded images and videos, generated carousel
              slides, edited content, and scheduled posts.
            </li>
            <li>Connect an Instagram professional account at the user&apos;s request.</li>
            <li>
              Schedule, publish, and track Instagram post status only after the
              user approves the content and destination account.
            </li>
            <li>
              Show the connected Instagram account, publishing settings, post
              history, analytics, and content-performance information.
            </li>
            <li>Troubleshoot failed uploads, rendering jobs, publishing jobs, or account connections.</li>
            <li>Detect abuse, protect the service, and comply with legal and Instagram requirements.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Connected Instagram accounts">
          <p>
            UGC Pilot currently supports Instagram professional accounts for
            connected-account, scheduling, publishing, and analytics features.
            We use Instagram account data only to provide the features the user
            requests.
          </p>
          <p>
            We do not sell Instagram account data. We do not publish content to
            Instagram without the user reviewing and approving the content,
            destination account, and schedule.
          </p>
          <p>
            Users can disconnect Instagram from UGC Pilot Settings or revoke
            UGC Pilot&apos;s access through their Instagram or Meta account
            settings.
          </p>
        </LegalSection>

        <LegalSection title="Access tokens and account permissions">
          <p>
            We may store Instagram access tokens securely so users can keep an
            account connected, schedule approved content, publish at the
            selected time, and display authorized insights. Users can
            disconnect Instagram at any time. When a user disconnects the
            account, we delete or revoke stored tokens where technically
            possible.
          </p>
          <p>
            We request Instagram permissions only for identifying the
            professional account selected by the user, publishing
            user-approved content, and retrieving account or media insights
            displayed in UGC Pilot. Tokens are retained only while needed to
            provide those authorized features, unless limited retention is
            required for security, legal, or dispute-resolution reasons.
          </p>
        </LegalSection>

        <LegalSection title="Uploaded media and generated content">
          <p>
            We store uploaded or selected images and videos so users can create
            drafts, prepare carousel slides and video content, edit creative
            assets, schedule Instagram posts, and publish at the selected time.
            Users can delete drafts, uploaded media, scheduled posts, or their
            account.
          </p>
          <p>
            Uploaded media is deleted within 30 days after account deletion
            unless limited records must be retained for security, fraud
            prevention, billing, legal compliance, or dispute resolution.
          </p>
        </LegalSection>

        <LegalSection title="AI-assisted content">
          <p>
            UGC Pilot provides AI-assisted content preparation, including
            personalized ideas, automatic multi-slide carousel drafts, captions,
            and video editing workflows. Users may review, modify, save, or
            discard these outputs before scheduling them.
          </p>
          <p>
            We may process and store information associated with this
            functionality, including user instructions, uploaded media,
            generated outputs, selected assets, and whether particular content
            requires an AI-generated content disclosure.
          </p>
          <p>
            When a user chooses to publish content to Instagram, we may transmit
            the applicable content settings and disclosures required by
            Instagram.
          </p>
        </LegalSection>

        <LegalSection title="Information sharing">
          <p>
            We share information only as needed to provide the service, follow
            user instructions, operate the product, and comply with law or
            Instagram requirements.
          </p>
          <LegalList>
            <li>
              Meta and Instagram, when the user connects an Instagram account,
              requests Instagram data, or schedules or publishes approved
              content.
            </li>
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
            <a className="font-bold text-primary" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            . Data deletion instructions are available at{" "}
            <a className="font-bold text-primary" href="https://getugcpilot.com/data-deletion">
              https://getugcpilot.com/data-deletion
            </a>
            .
          </p>
          <p>
            Deletion includes connected Instagram identifiers, stored access
            tokens where technically possible, uploaded or generated media,
            carousel slides, drafts, scheduled posts, captions, publishing
            records, and stored Instagram analytics associated with the account,
            subject to limited legal, security, billing, or dispute-resolution
            retention needs.
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
            <a className="font-bold text-primary" href="mailto:privacy@getugcpilot.com">
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
