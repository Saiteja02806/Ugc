type GoogleServiceAccountCredentials = {
  client_email: string;
  private_key: string;
  private_key_id?: string;
  project_id?: string;
  type?: string;
};

const CREDENTIALS_JSON_ENV_NAMES = [
  "GOOGLE_CLOUD_CREDENTIALS_JSON",
  "GOOGLE_APPLICATION_CREDENTIALS_JSON",
  "GCP_SERVICE_ACCOUNT_KEY_JSON",
] as const;

const CLIENT_EMAIL_ENV_NAMES = [
  "GOOGLE_CLOUD_CLIENT_EMAIL",
  "GCP_CLIENT_EMAIL",
] as const;

const PRIVATE_KEY_ENV_NAMES = [
  "GOOGLE_CLOUD_PRIVATE_KEY",
  "GCP_PRIVATE_KEY",
] as const;

export function getGoogleServiceAccountCredentials(
  env: Record<string, string | undefined> = process.env,
): GoogleServiceAccountCredentials | null {
  const jsonCredential = getFirstEnv(env, CREDENTIALS_JSON_ENV_NAMES);

  if (jsonCredential) {
    return parseServiceAccountJson(jsonCredential.value, jsonCredential.name);
  }

  const clientEmail = getFirstEnv(env, CLIENT_EMAIL_ENV_NAMES)?.value;
  const privateKey = getFirstEnv(env, PRIVATE_KEY_ENV_NAMES)?.value;

  if (!clientEmail && !privateKey) {
    return null;
  }

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Incomplete GCP service account credentials. Set both GOOGLE_CLOUD_CLIENT_EMAIL and GOOGLE_CLOUD_PRIVATE_KEY, or set GOOGLE_CLOUD_CREDENTIALS_JSON.",
    );
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
  };
}

export function getMissingVercelGcpCredentialEnvVars(
  env: Record<string, string | undefined> = process.env,
) {
  if (!isVercelRuntime(env) || hasExplicitServiceAccountCredentials(env)) {
    return [];
  }

  return [
    "GOOGLE_CLOUD_CREDENTIALS_JSON or GOOGLE_CLOUD_CLIENT_EMAIL/GOOGLE_CLOUD_PRIVATE_KEY",
  ];
}

function hasExplicitServiceAccountCredentials(
  env: Record<string, string | undefined>,
) {
  const hasJson = Boolean(getFirstEnv(env, CREDENTIALS_JSON_ENV_NAMES));
  const hasSplitCredentials = Boolean(
    getFirstEnv(env, CLIENT_EMAIL_ENV_NAMES) &&
      getFirstEnv(env, PRIVATE_KEY_ENV_NAMES),
  );

  return hasJson || hasSplitCredentials;
}

function isVercelRuntime(env: Record<string, string | undefined>) {
  return env.VERCEL === "1" || env.VERCEL === "true";
}

function getFirstEnv<const T extends readonly string[]>(
  env: Record<string, string | undefined>,
  names: T,
) {
  for (const name of names) {
    const value = env[name]?.trim();

    if (value) {
      return { name, value };
    }
  }

  return null;
}

function parseServiceAccountJson(
  rawValue: string,
  envName: string,
): GoogleServiceAccountCredentials {
  const parsedValue = parseJsonOrBase64Json(rawValue, envName);
  const clientEmail = getStringField(parsedValue, "client_email");
  const privateKey = getStringField(parsedValue, "private_key");

  if (!clientEmail || !privateKey) {
    throw new Error(
      `Invalid ${envName}. Expected a GCP service account JSON value with client_email and private_key.`,
    );
  }

  return {
    client_email: clientEmail,
    private_key: normalizePrivateKey(privateKey),
    private_key_id: getStringField(parsedValue, "private_key_id"),
    project_id: getStringField(parsedValue, "project_id"),
    type: getStringField(parsedValue, "type"),
  };
}

function parseJsonOrBase64Json(rawValue: string, envName: string) {
  const trimmedValue = rawValue.trim();
  const candidates = [
    trimmedValue,
    Buffer.from(trimmedValue, "base64").toString("utf8"),
  ];

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as Record<string, unknown>;
    } catch {
      // Try the next supported encoding.
    }
  }

  throw new Error(
    `Invalid ${envName}. Expected raw JSON or base64-encoded service account JSON.`,
  );
}

function getStringField(value: Record<string, unknown>, fieldName: string) {
  const fieldValue = value[fieldName];

  return typeof fieldValue === "string" && fieldValue.trim()
    ? fieldValue.trim()
    : undefined;
}

function normalizePrivateKey(privateKey: string) {
  return privateKey.replace(/\\n/g, "\n");
}
