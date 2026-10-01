import { createNotification } from "./notifications";
import { supabase } from "./supabase";

const DEVICE_ID_KEY = "citynside_device_id";

function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

function getDeviceLabel(): string {
  const platform = navigator.platform?.trim();
  const agent = navigator.userAgent;
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "navigateur";
  return `${browser}${platform ? ` sur ${platform}` : ""}`;
}

export async function registerCurrentDevice(userId: string): Promise<void> {
  const deviceId = getDeviceId();
  const { data, error } = await supabase
    .from("profiles")
    .select("known_device_ids")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    // The profile migration may not yet be applied. Keep this browser from
    // generating a notification on every reload, and report the DB error.
    const fallbackKey = `citynside_seen_device_${userId}`;
    if (!localStorage.getItem(fallbackKey)) localStorage.setItem(fallbackKey, deviceId);
    console.warn("Détection multi-appareils indisponible : appliquez la migration correspondante.", error);
    return;
  }

  const knownDevices = (data?.known_device_ids || []) as string[];
  if (knownDevices.includes(deviceId)) return;
  const { error: saveError } = await supabase.from("profiles").upsert(
    { id: userId, known_device_ids: [...knownDevices, deviceId] },
    { onConflict: "id" },
  );
  if (saveError) {
    console.warn("Appareil courant non mémorisé dans le profil :", saveError);
    return;
  }

  if (knownDevices.length > 0) {
    const connectedAt = new Date();
    await createNotification(userId, {
      id: `new_device_${userId}_${deviceId}`,
      title: "Connexion depuis un nouvel appareil",
      description: `Connexion détectée le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(connectedAt)} depuis ${getDeviceLabel()}.`,
      kind: "system",
      importance: "important",
    });
  }
}
