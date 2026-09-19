import { api } from "../api";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  // `new Uint8Array(array)` (unlike `.from`) is typed with a concrete
  // ArrayBuffer, which is what PushManager.subscribe's applicationServerKey expects.
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Registers the service worker, asks for notification permission, subscribes
 * to Web Push with the server's VAPID key, and hands the subscription to the
 * backend so it can target this browser from sendPriceDropAlert().
 */
export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported"> {
  if (!isPushSupported()) return "unsupported";

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";

  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const { publicKey } = await api.getVapidPublicKey();

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.subscribePush(subscription.toJSON() as PushSubscriptionJSON);
  return "granted";
}
