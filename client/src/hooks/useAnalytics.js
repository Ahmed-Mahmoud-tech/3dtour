import { useEffect, useRef, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
// Static (self-hosted export) builds have no API — tracking is compiled out.
const DISABLED = import.meta.env.VITE_STATIC_TOUR === "1";

const FLUSH_INTERVAL_MS = 10_000;
const VISITOR_KEY = "gv_visitor_id";

const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const getVisitorId = () => {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = uuid();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return uuid(); // storage blocked → per-page visitor, still counted
  }
};

/**
 * useAnalytics — fire-and-forget event tracking for the tour viewer.
 *
 * Events are queued in memory and flushed in batches: every 10 s, and via
 * navigator.sendBeacon on tab hide/close so the tail of a visit isn't lost.
 * Payloads go to POST /api/analytics/collect as text/plain (beacons can't
 * send application/json without a preflight). Tracking must never affect the
 * viewer — every network error is swallowed.
 *
 * Returns track(type, { nodeId, targetId }).
 */
export function useAnalytics(tourId, enabled = true) {
  const active = Boolean(tourId) && enabled && !DISABLED;

  const queueRef = useRef([]);
  const seqRef = useRef(0);
  const sessionIdRef = useRef(null);
  if (sessionIdRef.current === null) sessionIdRef.current = uuid();

  const activeRef = useRef(active);
  activeRef.current = active;
  const tourIdRef = useRef(tourId);
  tourIdRef.current = tourId;

  const flush = useCallback((useBeacon = false) => {
    if (!activeRef.current || queueRef.current.length === 0) return;
    const events = queueRef.current.splice(0, queueRef.current.length);
    const payload = JSON.stringify({
      tourId: tourIdRef.current,
      visitorId: getVisitorId(),
      sessionId: sessionIdRef.current,
      events,
    });
    const url = `${API_BASE}/analytics/collect`;

    try {
      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([payload], { type: "text/plain" }));
      } else {
        fetch(url, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      /* analytics never breaks the viewer */
    }
  }, []);

  const track = useCallback((type, { nodeId = "", targetId = "" } = {}) => {
    if (!activeRef.current) return;
    queueRef.current.push({ type, nodeId, targetId, seq: seqRef.current++ });
  }, []);

  // session start + periodic / on-hide flushing
  useEffect(() => {
    if (!active) return;

    track("session_start");

    const interval = setInterval(() => flush(false), FLUSH_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush(true);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tourId]);

  return track;
}
