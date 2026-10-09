import { Storage } from "@google-cloud/storage";
import { createClient } from "@supabase/supabase-js";
import { getGoogleServiceAccountCredentials } from "../lib/gcp/credentials.ts";

export function maintenanceClients() {
  const required = (...names) => {
    for (const name of names) if (process.env[name]?.trim()) return process.env[name].trim();
    throw new Error(`Missing ${names[0]}; supply an approved environment file explicitly.`);
  };
  const primary = required("GCP_STORAGE_BUCKET", "GOOGLE_CLOUD_STORAGE_BUCKET");
  const privateBucket = process.env.GCP_PRIVATE_MEDIA_BUCKET?.trim();
  if (privateBucket === primary) throw new Error("Private and public buckets must differ.");
  const credentials = getGoogleServiceAccountCredentials();
  return {
    primary, privateBucket,
    storage: new Storage({ ...(credentials ? { credentials } : {}),
      projectId: process.env.GCP_PROJECT_ID?.trim() || process.env.GOOGLE_CLOUD_PROJECT?.trim() }),
    db: createClient(required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
      required("SUPABASE_SERVICE_ROLE_KEY"), { auth: { autoRefreshToken: false, persistSession: false } }),
  };
}
