import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

/**
 * "Leave a message" modal for tour visitors. Posts to the public
 * /api/messages/:tourId endpoint; the tour owner reads it in their dashboard.
 * Not rendered in static (self-hosted) exports — there is no API there.
 */
export default function MessageForm({ tourId, nodeId, onClose }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`${API}/messages/${tourId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, nodeId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || "Could not send your message");
      }
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-gray-900/95 border border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {sent ? (
          <div className="flex flex-col items-center gap-3 text-center py-4">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <path d="M22 4 12 14.01l-3-3" />
            </svg>
            <p className="text-white font-medium">Message sent</p>
            <p className="text-white/50 text-sm">
              Thank you — the tour owner will see your message.
            </p>
            <button
              onClick={onClose}
              className="mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-white font-semibold">Leave a message</h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-white/50 hover:text-white transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <input
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500"
              placeholder="Your name"
              value={name}
              required
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500"
              type="email"
              placeholder="Email (optional, for a reply)"
              value={email}
              maxLength={200}
              onChange={(e) => setEmail(e.target.value)}
            />
            <textarea
              className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500 resize-none"
              placeholder="Your message…"
              rows={4}
              value={message}
              required
              maxLength={2000}
              onChange={(e) => setMessage(e.target.value)}
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              disabled={busy}
              className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
            >
              {busy ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
