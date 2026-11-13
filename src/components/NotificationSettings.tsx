"use client";

import { useEffect, useRef, useState } from "react";
import { currentSubscription, disablePush, enablePush, pushSupport, syncPush, testNotification } from "@/lib/push";
import type { Level } from "@/lib/types";
import { BellIcon } from "./Icons";

type Status = "checking" | "unsupported" | "ios-install" | "no-key" | "denied" | "off" | "on";

export function NotificationSettings({ areaCode, levels }: { areaCode: string | null; levels: Level[] }) {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: "ok" | "error" } | null>(null);

  // Find out the current state once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const support = pushSupport();
      let next: Status;
      if (support !== "ok") next = support;
      else if (Notification.permission === "denied") next = "denied";
      else next = (await currentSubscription()) ? "on" : "off";
      if (alive) setStatus(next);
    })().catch(() => alive && setStatus("unsupported"));
    return () => {
      alive = false;
    };
  }, []);

  // When area or levels change while notifications are on, update the server.
  const levelsKey = levels.join(",");
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (status === "on" && areaCode) {
      syncPush(areaCode, levelsKey ? (levelsKey.split(",") as Level[]) : []).catch(() => {});
    }
  }, [areaCode, levelsKey, status]);

  async function turnOn() {
    if (!areaCode) {
      setMessage({ text: "Choose your city or town above first.", tone: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await enablePush(areaCode, levels);
      setStatus("on");
      setMessage({ text: "Notifications are on. We'll alert you when classes are suspended in your area.", tone: "ok" });
    } catch (e) {
      if (Notification.permission === "denied") setStatus("denied");
      setMessage({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      await disablePush();
      setStatus("off");
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setMessage(null);
    try {
      if (Notification.permission !== "granted" && (await Notification.requestPermission()) !== "granted") {
        setStatus("denied");
        return;
      }
      await testNotification();
      setMessage({ text: "Sample notification sent. Didn't see it? Check your phone's notification settings.", tone: "ok" });
    } catch (e) {
      setMessage({ text: (e as Error).message, tone: "error" });
    }
  }

  const primary = "w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-brand-ink transition hover:opacity-90 disabled:opacity-60";
  const secondary = "w-full rounded-xl border border-line px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-2 disabled:opacity-60";

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BellIcon width={18} height={18} />
          <h2 className="font-semibold">Notifications</h2>
        </div>
        {status === "on" && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">On</span>}
      </div>
      <p className="mt-1 text-sm text-muted">Get an alert on this phone when a suspension is announced for your area and levels.</p>

      <div className="mt-3 space-y-2">
        {status === "checking" && <p className="text-sm text-muted">Checking…</p>}
        {status === "unsupported" && <p className="text-sm text-muted">This browser doesn&apos;t support notifications. Try Chrome on Android, or install the app on iPhone.</p>}
        {status === "no-key" && <p className="text-sm text-muted">Notifications aren&apos;t set up on this server yet.</p>}
        {status === "ios-install" && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            On iPhone, first add Deklarado to your Home Screen: tap <strong>Share</strong> → <strong>Add to Home Screen</strong>, then open it from there and come back here.
          </p>
        )}
        {status === "denied" && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
            Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.
          </p>
        )}
        {status === "off" && <button type="button" className={primary} onClick={turnOn} disabled={busy}>{busy ? "Turning on…" : "Turn on notifications"}</button>}
        {status === "on" && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={secondary} onClick={test}>Send a test</button>
            <button type="button" className={secondary} onClick={turnOff} disabled={busy}>{busy ? "Turning off…" : "Turn off"}</button>
          </div>
        )}
        {status === "off" && <button type="button" className={secondary} onClick={test}>Send a test</button>}
        {message && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.tone === "ok" ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
