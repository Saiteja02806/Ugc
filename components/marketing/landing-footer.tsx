type FooterLink = { href: string; label: string; external?: boolean };

export function LandingFooter({
  legalLinks,
  moreLinks,
}: {
  legalLinks: FooterLink[];
  moreLinks: FooterLink[];
}) {
  const linkClass = "inline-flex min-h-11 items-center rounded-sm hover:text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

  return (
    <footer data-landing-footer className="relative isolate overflow-hidden bg-[#141414] px-5 pt-10 text-sm text-[#BDBDBD] sm:px-8 sm:pt-12 lg:px-10">
      <div className="relative z-10 mx-auto flex max-w-[1360px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <p className="shrink-0">© UGCPilot 2026.</p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 sm:gap-x-7">
          <nav aria-label="Footer legal" className="flex flex-wrap items-center gap-x-5 sm:gap-x-7">
            <a href="/privacy" className={linkClass}>Privacy</a>
            <a href="/terms" className={linkClass}>Terms</a>
            <a href="/terms" className={linkClass}>Copyright</a>
            <details className="relative">
              <summary className={`${linkClass} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}>More <span aria-hidden="true" className="ml-1 text-xs">+</span></summary>
              <nav aria-label="More footer links" className="mt-2 max-h-60 w-60 overflow-y-auto border border-[#333333] bg-[#141414] p-3">
                {[...legalLinks.filter(link => !["/privacy", "/terms"].includes(link.href)), ...moreLinks].map(link => (
                  <a key={`${link.label}-${link.href}`} href={link.href} target={link.external ? "_blank" : undefined} rel={link.external ? "noopener noreferrer" : undefined} className={`${linkClass} flex px-2`}>{link.label}</a>
                ))}
              </nav>
            </details>
          </nav>
        </div>
      </div>
      <div aria-hidden="true" data-footer-wordmark className="pointer-events-none relative -mb-[0.22em] mt-20 select-none whitespace-nowrap text-center text-[clamp(4rem,20.5vw,22rem)] font-black leading-[0.9] tracking-[-0.075em] text-[#242424] sm:mt-28 lg:mt-36">UGCPilot</div>
    </footer>
  );
}
