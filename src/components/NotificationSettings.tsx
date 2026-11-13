"use client";

import { useEffect, useRef, useState } from "react";
import { currentSubscription, disablePush, enablePush, pushSupport, syncPush, testNotification } from "@/lib/push";
import { useT } from "@/lib/i18n";
import type { Level } from "@/lib/types";
import { BellIcon } from "./Icons";

type Status = "checking" | "unsupported" | "ios-install" | "no-key" | "denied" | "off" | "on";

export function NotificationSettings({ areaCode, levels }: { areaCode: string | null; levels: Level[] }) {
  const { t, lang } = useT();
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
      syncPush(areaCode, levelsKey ? (levelsKey.split(",") as Level[]) : [], lang).catch(() => {});
    }
  }, [areaCode, levelsKey, status, lang]);

  async function turnOn() {
    if (!areaCode) {
      setMessage({ text: t("notif.chooseArea"), tone: "error" });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await enablePush(areaCode, levels, lang);
      setStatus("on");
      setMessage({ text: t("notif.enabled"), tone: "ok" });
    } catch (e) {
      if (Notification.permission === "denied") {
        setStatus("denied");
      } else {
        const status = (e as { status?: number }).status;
        setMessage({ text: t(status === 503 ? "notif.unavailable" : "notif.failed"), tone: "error" });
      }
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
      await testNotification(t("notif.sample.title"), t("notif.sample.body"));
      setMessage({ text: t("notif.testSent"), tone: "ok" });
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
          <h2 className="font-semibold">{t("notif.title")}</h2>
        </div>
        {status === "on" && <span className="rounded-full bg-ok-soft px-2 py-0.5 text-xs font-medium text-ok">{t("notif.on")}</span>}
      </div>
      <p className="mt-1 text-sm text-muted">{t("notif.body")}</p>

      <div className="mt-3 space-y-2">
        {status === "checking" && <p className="text-sm text-muted">{t("notif.checking")}</p>}
        {status === "unsupported" && <p className="text-sm text-muted">{t("notif.unsupported")}</p>}
        {status === "no-key" && <p className="text-sm text-muted">{t("notif.noKey")}</p>}
        {status === "ios-install" && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{t("notif.ios")}</p>
        )}
        {status === "denied" && (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">{t("notif.denied")}</p>
        )}
        {status === "off" && <button type="button" className={primary} onClick={turnOn} disabled={busy}>{busy ? t("notif.turningOn") : t("notif.turnOn")}</button>}
        {status === "on" && (
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={secondary} onClick={test}>{t("notif.test")}</button>
            <button type="button" className={secondary} onClick={turnOff} disabled={busy}>{busy ? t("notif.turningOff") : t("notif.turnOff")}</button>
          </div>
        )}
        {status === "off" && <button type="button" className={secondary} onClick={test}>{t("notif.test")}</button>}
        {message && (
          <p role="status" className={`rounded-lg px-3 py-2 text-sm ${message.tone === "ok" ? "bg-ok-soft text-ok" : "bg-danger-soft text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
