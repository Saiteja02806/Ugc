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
    "Instructions for deleting UGC Pilot account data, connected Instagram data, uploaded media, generated carousels, and scheduling records.",
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
      title="Delete Instagram account data and content"
      description="UGC Pilot users can disconnect Instagram, delete uploaded or generated content, and request deletion of their account data."
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
            <li>Open the Instagram publishing section.</li>
            <li>Disconnect Instagram.</li>
            <li>Return to Settings.</li>
            <li>Select Request account deletion to email a full account and data deletion request.</li>
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
            <li>Connected Instagram identifiers and professional account IDs.</li>
            <li>Instagram access tokens where technically possible.</li>
            <li>Uploaded images, videos, product demos, and screen recordings.</li>
            <li>Generated videos, carousel slides, drafts, captions, and thumbnails.</li>
            <li>Instagram schedules and publishing logs where deletion is legally and technically possible.</li>
            <li>Stored Instagram media metadata and insights associated with the account.</li>
            <li>Stored AI disclosure, commercial disclosure, and rights confirmation settings.</li>
          </LegalList>
        </LegalSection>

        <LegalSection title="Instagram-specific notes">
          <p>
            Disconnecting or deleting data in UGC Pilot does not delete content
            that has already been published on Instagram. To delete a post that
            is already live, use Instagram directly.
          </p>
          <p>
            Disconnecting Instagram stops future UGC Pilot scheduling and
            publishing through that connection. Users may also revoke access
            through their Instagram or Meta account settings.
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
            Meta can send platform-initiated Instagram data deletion requests
            to{" "}
            <a href="https://www.getugcpilot.com/api/meta/data-deletion">
              https://www.getugcpilot.com/api/meta/data-deletion
            </a>
            . The endpoint validates the request and returns a confirmation code
            and status URL for the associated deletion request.
          </p>
        </LegalSection>
      </div>
    </LegalPageShell>
  );
}
