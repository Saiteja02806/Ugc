import type { Metadata } from "next";

import {
  LegalList,
  LegalNotice,
  LegalPageShell,
  LegalSection,
} from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "Data Deletion",
  description:
    "Instructions for deleting UGC Pilot account data, connected social account data, uploaded media, and stored publishing data.",
};

type DataDeletionPageProps = {
  searchParams?: Promise<{
    confirmation?: string | string[] | undefined;
  }>;
};

export default async function DataDeletionPage({
  searchParams,
}: DataDeletionPageProps) {
  const params = searchParams ? await searchParams : {};
  const confirmation =
    typeof params.confirmation === "string" ? params.confirmation : undefined;

  return (
    <LegalPageShell
      eyebrow="Data deletion"
      title="Delete connected account data and content"
      description="UGC Pilot users can disconnect social accounts, delete uploaded content, and request deletion of account data."
    >
      <div className="space-y-8">
        {confirmation ? (
          <LegalNotice>
            We received a platform data deletion request. Confirmation code:{" "}
            <span className="font-black">{confirmation}</span>
          </LegalNotice>
        ) : null}

        <LegalSection title="How to request deletion">
          <LegalList>
            <li>Sign in to UGC Pilot.</li>
            <li>Open Settings.</li>
            <li>Select Connected Accounts.</li>
            <li>Disconnect Instagram, TikTok, or YouTube.</li>
            <li>Open Account Settings.</li>
            <li>Select Delete Account and Data.</li>
          </LegalList>
          <p>
            You can also request deletion by emailing{" "}
            <a className="font-bold text-[#c2410c]" href="mailto:privacy@getugcpilot.com">
              privacy@getugcpilot.com
            </a>
            .
          </p>
        </LegalSection>

        <LegalSection title="What we delete">
          <LegalList>
            <li>Connected platform identifiers and social account IDs.</li>
            <li>Access tokens and refresh tokens where technically possible.</li>
            <li>Uploaded media, product demos, app recordings, and screen recordings.</li>
            <li>Generated videos, generated carousels, drafts, captions, and thumbnails.</li>
            <li>Scheduled posts and publishing logs where deletion is legally and technically possible.</li>
            <li>Stored analytics associated with the account.</li>
            <li>Stored AI disclosure, commercial disclosure, and rights confirmation settings.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Platform-specific notes">
          <p>
            Disconnecting or deleting data in UGC Pilot does not delete content
            that has already been published on TikTok, Instagram, YouTube, or
            another social platform. To delete a post already published on a
            social platform, use that platform directly.
          </p>
          <p>
            For YouTube, you can also revoke UGC Pilot access from Google
            security settings at{" "}
            <a
              className="font-bold text-[#c2410c]"
              href="https://security.google.com/settings/security/permissions"
              rel="noreferrer"
              target="_blank"
            >
              https://security.google.com/settings/security/permissions
            </a>
            . When YouTube access is revoked or deletion is requested, we delete
            stored YouTube API data as soon as possible. User deletion and
            account deletion requests are completed within 7 calendar days, and
            Google security settings revocations are completed within 30
            calendar days, unless retention is required by law.
          </p>
        </LegalSection>

        <LegalSection title="Retention exceptions">
          <p>
            Some limited records may be retained for security, fraud prevention,
            billing, legal compliance, backup recovery, or dispute resolution.
            Uploaded media is deleted within 30 days after account deletion
            unless one of these limited exceptions applies.
          </p>
        </LegalSection>

        <LegalSection title="Meta data deletion callback">
          <p>
            Meta and Instagram data deletion requests can be sent to{" "}
            <span className="font-bold text-[#18181b]">
              https://getugcpilot.com/api/meta/data-deletion
            </span>
            . This endpoint is used for platform-initiated deletion requests.
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
