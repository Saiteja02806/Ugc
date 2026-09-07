import { ProviderRequestNotSubmittedError } from "./generation-provider.js";

export function getRequiredProviderEnv(
  name: string,
  environment: Readonly<Record<string, string | undefined>> = process.env,
) {
  const value = environment[name]?.trim();

  if (!value) {
    throw new ProviderRequestNotSubmittedError(`Missing ${name}.`);
  }

  // API keys are single-line values. Rejecting a pasted dotenv assignment or a
  // second secret here prevents it from being sent in an HTTP header or saved
  // back into job failure diagnostics.
  if (
    /[\r\n]/.test(value) ||
    /^[A-Za-z_][A-Za-z0-9_]*\s*=/.test(value)
  ) {
    throw new ProviderRequestNotSubmittedError(
      `Invalid ${name} configuration. Configure one key value only.`,
    );
  }

  return value;
}
