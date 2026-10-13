import { z } from "zod";
import { parsePublishingPreferencesUpdate } from "../scheduling/publishing-preferences";
import { validateTimeZone } from "../scheduling/schedule-time";

export const settingsRevisionSchema=z.string().regex(/^[a-f0-9]{64}$/);
export const publishingPreferencesSchema=z.strictObject({
  containsSyntheticMedia:z.boolean(),tiktokPrivacyLevel:z.enum(["PUBLIC_TO_EVERYONE","SELF_ONLY","FOLLOWER_OF_CREATOR","MUTUAL_FOLLOW_FRIENDS"]),
  tiktokAllowComments:z.boolean(),youtubePrivacyStatus:z.enum(["public","private","unlisted"]),
  youtubeMadeForKids:z.boolean(),youtubeNotifySubscribers:z.boolean(),
});
export const publishingPreferencesPatchSchema=publishingPreferencesSchema.partial().refine(value=>Object.keys(value).length>0,"Choose at least one publishing default.");
export const accountSettingsStateSchema=z.strictObject({publishing_revision:settingsRevisionSchema,timezone_revision:settingsRevisionSchema,
  publishing_preferences_saved:z.boolean(),timezone_initialized:z.boolean(),timezone:z.string().min(1).max(100).nullable(),publishing_preferences:publishingPreferencesSchema,
}).refine(state=>state.timezone_initialized===(state.timezone!==null),"Timezone initialization state is inconsistent.");
export const accountSettingsOperationSchema=z.enum(["publishing_preferences","initialize_timezone"]);
export const accountSettingsReceiptSchema=z.strictObject({request_id:z.uuid(),operation:accountSettingsOperationSchema,initialized:z.boolean(),state:accountSettingsStateSchema}).refine(receipt=>receipt.operation!=="publishing_preferences"||!receipt.initialized,"A preferences update cannot initialize timezone.");
export const accountSettingsResultSchema=z.strictObject({replayed:z.boolean(),receipt:accountSettingsReceiptSchema});
export const publishingPreferencesWriteSchema=z.strictObject({request_id:z.uuid(),expected_revision:settingsRevisionSchema,preferences:publishingPreferencesPatchSchema});
export const timezoneInitializeSchema=z.strictObject({request_id:z.uuid(),expected_revision:settingsRevisionSchema,timezone:z.string().trim().min(1).max(100)});
export function normalizeSettingsInput(operation:z.infer<typeof accountSettingsOperationSchema>,value:unknown) {
  if(operation==="publishing_preferences") {
    const input=publishingPreferencesWriteSchema.omit({request_id:true}).parse(value);
    return {expected_revision:input.expected_revision,preferences:parsePublishingPreferencesUpdate(input.preferences)};
  }
  const input=timezoneInitializeSchema.omit({request_id:true}).parse(value);
  return {expected_revision:input.expected_revision,timezone:validateTimeZone(input.timezone)};
}
