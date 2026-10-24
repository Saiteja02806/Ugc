"use client";
import type { QueryClient } from "@tanstack/react-query";
const channelName = "ugc-social-connections-v1";

export function invalidateConnectionAnalytics(client: QueryClient, owner: string, broadcast = true) {
  void client.invalidateQueries({ queryKey: ["account", owner, "analytics"] });
  void client.invalidateQueries({ queryKey: ["account", owner, "analytics-activity"] });
  if (broadcast && typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(channelName);
    channel.postMessage({ owner, type: "connections-changed" });
    channel.close();
  }
}

export function subscribeConnectionChanges(client: QueryClient, owner: string) {
  if (typeof BroadcastChannel === "undefined") return () => {};
  const channel = new BroadcastChannel(channelName);
  channel.onmessage = ({ data }: MessageEvent) => {
    if (data?.type !== "connections-changed" || data.owner !== owner) return;
    invalidateConnectionAnalytics(client, owner, false);
    void client.invalidateQueries({ queryKey: ["account", owner, "social-connections"] });
  };
  return () => channel.close();
}
