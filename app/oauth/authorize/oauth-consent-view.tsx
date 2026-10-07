"use client";

import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CircleCheck,
  Eye,
  Images,
  KeyRound,
  Link2,
  LoaderCircle,
  LockKeyhole,
  type LucideIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { ConsentBrandMark } from "./consent-brand-mark";
import styles from "./oauth-consent.module.css";

const SCOPE_DETAILS: Record<string, { title: string; description: string; icon: LucideIcon }> = {
  "account:read": {
    title: "Account and plan",
    description: "View your account ID, plan, and available credits.",
    icon: UserRound,
  },
  "brand:read": {
    title: "Brand profile",
    description: "View your business, product, audience, and source URL.",
    icon: BriefcaseBusiness,
  },
  "assets:read": {
    title: "Creative library",
    description: "View your uploaded and generated media.",
    icon: Images,
  },
  "assets:write": {
    title: "Manage media",
    description: "Upload references and delete media you select.",
    icon: Upload,
  },
  "generation:write": {
    title: "Generate images and videos",
    description: "Create images and videos using your plan’s credits.",
    icon: Sparkles,
  },
  "jobs:read": {
    title: "Generation progress",
    description: "Check job status and retrieve completed results.",
    icon: Eye,
  },
};

type OAuthConsentViewProps = {
  clientName: string;
  redirectHost: string;
  redirectTitle: string;
  redirectDescription: string;
  isLocalCallback?: boolean;
  scopes: string[];
  accountLabel: string | null;
  emailVerified: boolean;
  loading: boolean;
  busy: boolean;
  switchingAccount?: boolean;
  error: string | null;
  signInControl: ReactNode;
  onDecision: (approve: boolean) => void;
  onSwitchAccount?: () => void;
};

// Authentication, scope validation, and redirects stay in the existing controller.
export function OAuthConsentView({
  clientName, redirectHost, redirectTitle, redirectDescription, isLocalCallback,
  scopes, accountLabel, emailVerified, loading, busy, switchingAccount = false,
  error, signInControl, onDecision, onSwitchAccount,
}: OAuthConsentViewProps) {
  const pending = busy || switchingAccount;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.brandHeader}>
          <div className={styles.wordmark}>
            <ConsentBrandMark className={styles.brandMark} />
            <span>UGC Pilot</span>
          </div>
          <span className={styles.secureLabel}>
            <LockKeyhole size={13} aria-hidden="true" /> Secure connection
          </span>
        </header>

        <section className={styles.card} aria-labelledby="oauth-consent-title">
          <div className={styles.intro}>
            <div className={styles.introText}>
              <h1 id="oauth-consent-title">Connect {clientName}</h1>
              <p className={styles.subtitle}>
                Give {clientName} the access below to your UGC Pilot account.
              </p>
            </div>
            <div className={styles.connection} aria-hidden="true">
              <ConsentBrandMark className={styles.connectionBrand} />
              <span className={styles.connectionLine}><Link2 size={16} /></span>
              <span className={styles.clientMark}><KeyRound size={23} strokeWidth={1.7} /></span>
            </div>
          </div>

          {accountLabel && !loading ? (
            <div className={styles.account}>
              <span className={styles.accountIcon}><UserRound size={18} aria-hidden="true" /></span>
              <div className={styles.accountIdentity}>
                <span className={styles.accountCaption}>UGC Pilot account</span>
                <p translate="no">{accountLabel}</p>
              </div>
              {onSwitchAccount ? (
                <button className={styles.switchAccount} type="button" disabled={pending} onClick={onSwitchAccount}>
                  {switchingAccount ? "Switching…" : "Switch"}
                  <ArrowUpRight size={14} aria-hidden="true" />
                  <span className={styles.srOnly}> account</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className={styles.permissions}>
            <div className={styles.sectionHeading}>
              <h2>{clientName} will be able to</h2>
              <span>{scopes.length} {scopes.length === 1 ? "permission" : "permissions"}</span>
            </div>
            <ul className={styles.permissionList}>
              {scopes.map((scope) => {
                const details = SCOPE_DETAILS[scope] ?? {
                  title: "Additional access", description: `Use the ${scope} permission.`, icon: KeyRound,
                };
                const Icon = details.icon;
                return (
                  <li key={scope}>
                    <Icon className={styles.permissionIcon} size={18} strokeWidth={1.7} aria-hidden="true" />
                    <div className={styles.permissionText}>
                      <h3>{details.title}</h3>
                      <p>{details.description}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className={styles.scopeNote}>
              Only these permissions are granted. Additional access needs your approval.
            </p>
          </div>

          <div className={styles.trustNote}>
            <ShieldCheck size={17} strokeWidth={1.7} aria-hidden="true" />
            <p>Your password and payment details stay private. Continue only if you started this connection.</p>
          </div>

          <footer className={styles.footer}>
            {loading ? (
              <p className={styles.status} role="status" aria-live="polite">
                <LoaderCircle className={styles.spinner} size={18} aria-hidden="true" />
                Checking your UGC Pilot sign-in…
              </p>
            ) : !accountLabel ? (
              <div className={styles.signIn}>
                <h2>Sign in to continue</h2>
                <p>Use the UGC Pilot account you want to connect.</p>
                {signInControl}
              </div>
            ) : !emailVerified ? (
              <p className={styles.verifyNotice} role="status">
                Verify this account’s email address in UGC Pilot, then return here to connect.
              </p>
            ) : (
              <div className={styles.actions}>
                <button type="button" className={styles.cancelButton} disabled={pending} onClick={() => onDecision(false)}>
                  Cancel
                </button>
                <button type="button" className={styles.allowButton} disabled={pending} aria-busy={busy} onClick={() => onDecision(true)}>
                  {busy ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <CircleCheck size={17} aria-hidden="true" />}
                  {busy ? "Connecting…" : "Allow access"}
                </button>
              </div>
            )}
            {error ? <p className={styles.error} role="alert">{error}</p> : null}
            <div className={styles.returnInfo}>
              <ArrowRight size={14} aria-hidden="true" />
              <div>
                <p>{redirectTitle}</p>
                <details className={styles.callbackDetails}>
                  <summary>Connection details</summary>
                  <p>{redirectDescription}</p>
                  <p className={styles.callbackHost} translate="no">
                    {isLocalCallback ? "Local callback" : "Callback"}: {redirectHost}
                  </p>
                </details>
              </div>
            </div>
          </footer>
        </section>

        <nav className={styles.legal} aria-label="UGC Pilot legal information">
          <a href="https://getugcpilot.com/privacy" rel="noreferrer" target="_blank">Privacy policy</a>
          <span aria-hidden="true">·</span>
          <a href="https://getugcpilot.com/terms" rel="noreferrer" target="_blank">Terms of service</a>
        </nav>
      </div>
    </main>
  );
}
