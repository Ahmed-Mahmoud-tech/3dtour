import { useState, useEffect, useRef } from "react";
import { FaSearch, FaTimes, FaSyncAlt } from "react-icons/fa";

/**
 * Shared list plumbing for the admin pages: debounced search box, prev/next
 * pager, and a searchable paginated picker used for assigning projects.
 */

/** Debounce a fast-changing value (search input → query param). */
export function useDebounced(value, ms = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function SearchInput({ value, onChange, placeholder = "Search…", className = "" }) {
  return (
    <div className={`relative ${className}`}>
      <FaSearch
        size={12}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
      />
      <input
        className="admin-input pl-8 pr-8 w-full"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-300"
        >
          <FaTimes size={12} />
        </button>
      )}
    </div>
  );
}

/** Prev/Next pager; renders nothing for a single page. */
export function Pager({ page, pages, onPage, className = "" }) {
  if (!pages || pages <= 1) return null;
  const btn =
    "px-2.5 py-1 rounded border border-gray-800 text-gray-400 text-xs " +
    "hover:border-gray-600 hover:text-gray-200 disabled:opacity-40 " +
    "disabled:hover:border-gray-800 disabled:hover:text-gray-400 transition-colors";
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        ← Prev
      </button>
      <span className="text-gray-500 text-xs">
        Page {page} of {pages}
      </span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next →
      </button>
    </div>
  );
}

/**
 * Searchable, paginated assign picker (replaces the old static <select> that
 * listed every project). `fetchPage({ q, page })` must resolve to
 * { items, total, page, pages }; `onPick(item)` receives the chosen item.
 */
export function AssignPicker({ buttonLabel, placeholder, fetchPage, getLabel, onPick }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const rootRef = useRef(null);
  const debouncedQ = useDebounced(q);

  useEffect(() => {
    if (!open) return;
    let stale = false;
    setLoading(true);
    fetchPage({ q: debouncedQ, page })
      .then((d) => !stale && setData(d))
      .catch(() => !stale && setData({ items: [], total: 0, page: 1, pages: 1 }))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
  }, [open, debouncedQ, page, fetchPage]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = async (item) => {
    if (picking) return;
    setPicking(true);
    try {
      await onPick(item);
      setOpen(false);
      setQ("");
      setPage(1);
    } finally {
      setPicking(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="admin-btn-secondary text-xs py-1.5"
      >
        {buttonLabel}
      </button>
    );
  }

  return (
    <div ref={rootRef} className="w-full max-w-sm flex flex-col gap-2 border border-gray-800 rounded-lg p-2 bg-gray-900">
      <SearchInput
        value={q}
        onChange={(v) => {
          setQ(v);
          setPage(1);
        }}
        placeholder={placeholder}
      />
      {loading && !data ? (
        <p className="text-gray-600 text-xs px-1 py-2">Loading…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-gray-600 text-xs px-1 py-2">
          {debouncedQ ? "No matches." : "Nothing available to assign."}
        </p>
      ) : (
        <ul className="flex flex-col">
          {data.items.map((item) => (
            <li key={item._id}>
              <button
                type="button"
                disabled={picking}
                onClick={() => pick(item)}
                className="w-full text-left text-xs text-gray-300 hover:text-white hover:bg-gray-800 rounded px-2 py-1.5 truncate flex items-center gap-2 disabled:opacity-50"
              >
                {picking && <FaSyncAlt size={10} className="animate-spin shrink-0" />}
                {getLabel(item)}
              </button>
            </li>
          ))}
        </ul>
      )}
      {data && <Pager page={data.page} pages={data.pages} onPage={setPage} />}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-gray-600 hover:text-gray-400 text-xs self-end"
      >
        Cancel
      </button>
    </div>
  );
}
