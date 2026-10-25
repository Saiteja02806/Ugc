import { brandInstagramProfileUrls } from "@/lib/marketing/brand-videos";

const brandInstagramProfiles = brandInstagramProfileUrls.map((url) => {
  const handle = new URL(url).pathname.split("/").filter(Boolean)[0];
  return { url, label: handle ? `@${handle}` : url };
});

/** Public Instagram profiles whose videos were made with UGC Pilot. */
export function BrandInstagramExampleAccounts({
  linkClassName = "font-semibold text-primary",
}: {
  linkClassName?: string;
}) {
  return (
    <>
      Instagram example accounts made with UGC Pilot are{" "}
      {brandInstagramProfiles.map((profile, index) => (
        <span key={profile.url}>
          {index === 0 ? null : index === brandInstagramProfiles.length - 1 ? ", and " : ", "}
          <a href={profile.url} className={linkClassName} rel="noopener noreferrer" target="_blank">
            {profile.label}
          </a>
        </span>
      ))}
      .
    </>
  );
}
