import type { DistanceUnit } from "./userPreferences";

export function formatDistance(meters: number, unit: DistanceUnit): string {
  if (unit === "walking-minutes") {
    return `~${Math.max(1, Math.round(meters / 75))} min à pied`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDistanceText(text: string, unit: DistanceUnit): string {
  if (unit === "meters") return text.replace(/(\d+)\s*m\b/gi, "$1 m");
  return text.replace(/(\d+)\s*m\b/gi, (_match, rawMeters: string) => formatDistance(Number(rawMeters), unit));
}
