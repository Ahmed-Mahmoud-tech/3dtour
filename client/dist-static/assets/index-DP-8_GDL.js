const __vite__mapDeps = (
  i,
  m = __vite__mapDeps,
  d = m.f ||
    (m.f = [
      "./index-DkIPaksv.js",
      "./iconBase-JnnPIufi.js",
      "./react-CoHgTPEx.js",
      "./index-Dlz6eCIb.js",
      "./index-CyyoiMmg.js",
      "./index-DrfRWBTz.js",
      "./index-nVumfo3O.js",
      "./index-Bj9eR4pF.js",
      "./index-Dsn-lxFo.js",
      "./index-BnR07znK.js",
    ]),
) => i.map((i) => d[i]);
import { r as t, j as r, c as nt, R as st } from "./react-CoHgTPEx.js";
import { a as ot, p as Ue } from "./vendor-pBhBMl1w.js";
import {
  b as at,
  P as it,
  e as ct,
  c as lt,
  a as ze,
  S as me,
  f as ut,
  V as le,
  g as ae,
  M as Z,
  Q as Ce,
  d as dt,
  u as ve,
  D as Ne,
  _ as J,
  H as ft,
  C as ht,
  j as Ve,
  E as mt,
  i as V,
  B as Fe,
  h as pt,
  R as De,
  T as Be,
} from "./three-y_le2OIE.js";
(function () {
  const n = document.createElement("link").relList;
  if (n && n.supports && n.supports("modulepreload")) return;
  for (const a of document.querySelectorAll('link[rel="modulepreload"]')) s(a);
  new MutationObserver((a) => {
    for (const d of a)
      if (d.type === "childList")
        for (const i of d.addedNodes)
          i.tagName === "LINK" && i.rel === "modulepreload" && s(i);
  }).observe(document, { childList: !0, subtree: !0 });
  function o(a) {
    const d = {};
    return (
      a.integrity && (d.integrity = a.integrity),
      a.referrerPolicy && (d.referrerPolicy = a.referrerPolicy),
      a.crossOrigin === "use-credentials"
        ? (d.credentials = "include")
        : a.crossOrigin === "anonymous"
          ? (d.credentials = "omit")
          : (d.credentials = "same-origin"),
      d
    );
  }
  function s(a) {
    if (a.ep) return;
    a.ep = !0;
    const d = o(a);
    fetch(a.href, d);
  }
})();
function xt() {
  const e = t.useRef(new Set()),
    n = t.useRef(new Set()),
    o = t.useRef(new Set()),
    s = t.useRef(!1),
    a = t.useCallback((u, b) => {
      const y = new Map(),
        x = [{ nodeId: b, distance: 0 }],
        m = new Set();
      for (; x.length > 0; ) {
        const { nodeId: j, distance: S } = x.shift();
        if (m.has(j)) continue;
        (m.add(j), y.set(j, S));
        const g = u[j];
        g != null &&
          g.navigationHotspots &&
          g.navigationHotspots.forEach((w) => {
            m.has(w.targetNodeId) ||
              x.push({ nodeId: w.targetNodeId, distance: S + 1 });
          });
      }
      return y;
    }, []),
    d = t.useCallback(
      (u, b) => {
        const y = a(u, b);
        return Object.keys(u)
          .map((x) => ({ nodeId: x, distance: y.get(x) ?? 1 / 0 }))
          .sort((x, m) =>
            x.distance !== m.distance
              ? x.distance - m.distance
              : x.nodeId.localeCompare(m.nodeId),
          );
      },
      [a],
    ),
    i = t.useCallback(
      (u) =>
        !u || e.current.has(u)
          ? Promise.resolve()
          : new Promise((b) => {
              const y = new Image();
              ((y.crossOrigin = "anonymous"),
                (y.onload = async () => {
                  try {
                    (y.decode && (await y.decode()), e.current.add(u), b());
                  } catch {
                    (console.warn(
                      "⚠️ Image decode failed:",
                      u.split("/").pop(),
                    ),
                      b());
                  }
                }),
                (y.onerror = () => {
                  (console.warn("⚠️ Image preload failed:", u.split("/").pop()),
                    b());
                }),
                (y.src = u));
            }),
      [],
    ),
    f = t.useCallback((u) => {
      if (!u || n.current.has(u)) return Promise.resolve();
      const b = new AbortController(),
        y = setTimeout(() => b.abort(), 15e3);
      return fetch(u, { signal: b.signal })
        .then((x) => {
          if (!x.ok) throw new Error(`HTTP ${x.status}`);
          return x.blob();
        })
        .then(() => {
          n.current.add(u);
        })
        .catch(() => {
          console.warn("⚠️ Video preload failed:", u.split("/").pop());
        })
        .finally(() => clearTimeout(y));
    }, []);
  t.useCallback(
    async (u, b, y = !1) => {
      if (!u) return;
      const x = [];
      (!y &&
        u.panoramaUrl &&
        !e.current.has(u.panoramaUrl) &&
        x.push(i(u.panoramaUrl)),
        u.navigationHotspots &&
          u.navigationHotspots.forEach((m) => {
            var j;
            if (
              (m.transitionVideoUrl &&
                !n.current.has(m.transitionVideoUrl) &&
                x.push(f(m.transitionVideoUrl)),
              m.transitionId &&
                (j = b.transitions) != null &&
                j[m.transitionId])
            ) {
              const S = b.transitions[m.transitionId];
              S.videoUrl && !n.current.has(S.videoUrl) && x.push(f(S.videoUrl));
            }
          }),
        x.length > 0 && (await Promise.all(x)),
        y || o.current.add(u.id));
    },
    [i, f],
  );
  const h = t.useCallback(
      async (u, b) => {
        s.current = !1;
        const x = d(u.nodes, b).filter(
          ({ nodeId: m, distance: j }) => !o.current.has(m) && j === 1,
        );
        if (x.length !== 0)
          for (let m = 0; m < x.length; m++) {
            if (s.current) return;
            const { nodeId: j } = x[m],
              S = u.nodes[j];
            (S != null &&
              S.panoramaUrl &&
              !e.current.has(S.panoramaUrl) &&
              (await i(S.panoramaUrl)),
              o.current.add(j),
              m < x.length - 1 &&
                (await new Promise((g) => setTimeout(g, 3e3))));
          }
      },
      [d, i],
    ),
    c = t.useCallback(() => {
      s.current = !0;
    }, []),
    v = t.useCallback(
      async (u, b) => {
        const y = [];
        (u != null && u.panoramaUrl && y.push(i(u.panoramaUrl)),
          b != null && b.videoUrl && y.push(f(b.videoUrl)),
          await Promise.all(y));
      },
      [i, f],
    ),
    p = t.useCallback(() => {
      (e.current.clear(), n.current.clear(), o.current.clear());
    }, []);
  return {
    preloadRemaining: h,
    cancelBackgroundLoading: c,
    preloadNextAssets: v,
    clearCache: p,
  };
}
const gt = "/api",
  vt = !0;
function bt(e) {
  var ee;
  const [n, o] = t.useState(null),
    [s, a] = t.useState(null),
    [d, i] = t.useState(!0),
    [f, h] = t.useState(null),
    [c, v] = t.useState(null),
    {
      preloadRemaining: p,
      cancelBackgroundLoading: u,
      preloadNextAssets: b,
    } = xt(),
    [y, x] = t.useState(null),
    [m, j] = t.useState(!1),
    [S, g] = t.useState(!0),
    [w, N] = t.useState([]),
    [U, O] = t.useState(0),
    [k, C] = t.useState(!1),
    E = t.useRef(null);
  (t.useEffect(() => {
    (async () => {
      var B, L, q, Q, W;
      try {
        i(!0);
        const { data: z } = await ot.get(
          vt ? "./tour.json" : `${gt}/projects/${e}/public`,
        );
        o(z);
        const G =
          ((B = z.settings) == null ? void 0 : B.initialNodeId) ||
          Object.keys(z.nodes)[0];
        a(G);
      } catch (z) {
        (h(
          ((q = (L = z.response) == null ? void 0 : L.data) == null
            ? void 0
            : q.message) || "Failed to load tour",
        ),
          v(
            ((W = (Q = z.response) == null ? void 0 : Q.data) == null
              ? void 0
              : W.reason) || null,
          ));
      } finally {
        i(!1);
      }
    })();
  }, [e]),
    t.useEffect(() => {
      var q, Q, W, z;
      const _ =
          (Q =
            (q = n == null ? void 0 : n.settings) == null
              ? void 0
              : q.globalBackgroundAudio) == null
            ? void 0
            : Q.src,
        B =
          ((z =
            (W = n == null ? void 0 : n.settings) == null
              ? void 0
              : W.globalBackgroundAudio) == null
            ? void 0
            : z.defaultVolume) ?? 0.4;
      if (!_) return;
      const L = new Audio(_);
      return (
        (L.loop = !0),
        (L.volume = B),
        (E.current = L),
        L.play().catch(() => {
          const G = () => {
            (L.play(), window.removeEventListener("click", G));
          };
          window.addEventListener("click", G, { once: !0 });
        }),
        () => {
          (L.pause(), (L.src = ""));
        }
      );
    }, [n]),
    t.useEffect(() => {
      if (!n || !s) return;
      u();
      const _ = setTimeout(() => {
        p(n, s);
      }, 5e3);
      return () => {
        (clearTimeout(_), u());
      };
    }, [n, s, p, u]));
  const T = t.useCallback(() => {
      if (!E.current) return;
      const _ = !k;
      (C(_), (E.current.muted = _));
    }, [k]),
    l = t.useCallback(
      (_, B, L = []) => {
        n &&
          _ !== s &&
          (L.length > 0
            ? (N(L),
              O(0),
              x({ videoUrl: L[0].videoUrl, targetNodeId: _ }),
              j(!0),
              g(!1))
            : B
              ? (N([]), O(0), x({ videoUrl: B, targetNodeId: _ }), j(!0), g(!1))
              : (N([]), O(0), x(null), j(!1), a(_)));
      },
      [n, s],
    ),
    I = t.useCallback(() => {
      (x(null), j(!1), g(!0), N([]), O(0));
    }, []),
    R = t.useCallback(() => {
      var B;
      if (!y) return;
      const _ = U + 1;
      if (w.length > 0 && _ < w.length) {
        const L = w[_].startNodeId;
        (L && (B = n == null ? void 0 : n.nodes) != null && B[L] && a(L),
          O(_),
          x((q) => ({ ...q, videoUrl: w[_].videoUrl })));
      } else {
        const L = y.targetNodeId;
        (x(null), j(!1), g(!0), a(L), N([]), O(0));
      }
    }, [y, w, U, n]),
    P = ((ee = n == null ? void 0 : n.nodes) == null ? void 0 : ee[s]) || null;
  return {
    project: n,
    activeNode: P,
    activeNodeId: s,
    loading: d,
    error: f,
    errorReason: c,
    transition: y,
    isTransitioning: m,
    hotspotVisible: S,
    audioMuted: k,
    toggleAudio: T,
    navigateTo: l,
    cancelTransition: I,
    onTransitionComplete: R,
    setActiveNodeId: a,
    preloadNextAssets: b,
    videoQueue: w,
    videoQueueIndex: U,
  };
}
const yt = "/api",
  _e = "gv_visitor_id",
  ge = () =>
    typeof crypto < "u" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  wt = () => {
    try {
      let e = localStorage.getItem(_e);
      return (e || ((e = ge()), localStorage.setItem(_e, e)), e);
    } catch {
      return ge();
    }
  };
function jt(e, n = !0) {
  const o = !!e && n && !1,
    s = t.useRef([]),
    a = t.useRef(0),
    d = t.useRef(null);
  d.current === null && (d.current = ge());
  const i = t.useRef(o);
  i.current = o;
  const f = t.useRef(e);
  ((f.current = e),
    t.useCallback((c = !1) => {
      if (!i.current || s.current.length === 0) return;
      const v = s.current.splice(0, s.current.length),
        p = JSON.stringify({
          tourId: f.current,
          visitorId: wt(),
          sessionId: d.current,
          events: v,
        }),
        u = `${yt}/analytics/collect`;
      try {
        c && navigator.sendBeacon
          ? navigator.sendBeacon(u, new Blob([p], { type: "text/plain" }))
          : fetch(u, {
              method: "POST",
              headers: { "Content-Type": "text/plain" },
              body: p,
              keepalive: !0,
            }).catch(() => {});
      } catch {}
    }, []));
  const h = t.useCallback((c, { nodeId: v = "", targetId: p = "" } = {}) => {
    i.current &&
      s.current.push({ type: c, nodeId: v, targetId: p, seq: a.current++ });
  }, []);
  return (t.useEffect(() => {}, [o, e]), h);
}
const He = 50,
  Te = (e) => (e * Math.PI) / 180;
function kt(e, n, o = He) {
  const s = Te(e),
    a = Te(n),
    d = -o * Math.sin(a) * Math.cos(s),
    i = o * Math.cos(a),
    f = -o * Math.sin(a) * Math.sin(s);
  return { x: d, y: i, z: f };
}
function $e(e, n, o = He) {
  const { x: s, y: a, z: d } = kt(e, n, o);
  return [s, a, d];
}
const pe = 3.1,
  St = 0.92,
  Rt = 0.34,
  Et = 0.22,
  It = 0.05,
  Mt = "#fff",
  Ct = new at(1.3, 32),
  Le = new it(2.6, 2.6),
  We = 12,
  Ge = (Math.PI * 2) / We,
  Nt = new ct(1.16, 1.28, 8, 1, 0, Ge * 0.6),
  _t = Array.from({ length: We }, (e, n) => n * Ge);
function Tt(e, n) {
  const o = new ut(),
    s = e.length;
  for (let a = 0; a < s; a++) {
    const d = e[(a + s - 1) % s],
      i = e[a],
      f = e[(a + 1) % s],
      h = i.clone().sub(d),
      c = f.clone().sub(i),
      v = Math.min(n, h.length() / 2, c.length() / 2),
      p = i.clone().sub(h.normalize().multiplyScalar(v)),
      u = i.clone().add(c.normalize().multiplyScalar(v));
    (a === 0 ? o.moveTo(p.x, p.y) : o.lineTo(p.x, p.y),
      o.quadraticCurveTo(i.x, i.y, u.x, u.y));
  }
  return (o.closePath(), o);
}
const Lt = (() => {
    const e = [
        new le(0, 0.9),
        new le(0.72, -0.55),
        new le(0, -0.18),
        new le(-0.72, -0.55),
      ],
      n = new lt(Tt(e, 0.16), {
        depth: 0.12,
        bevelEnabled: !0,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
    return (n.center(), n);
  })(),
  Ot = (() => {
    const n = document.createElement("canvas");
    n.width = n.height = 128;
    const o = n.getContext("2d"),
      s = o.createRadialGradient(
        128 * 0.38,
        128 * 0.34,
        128 * 0.05,
        128 * 0.5,
        128 * 0.5,
        128 * 0.62,
      );
    (s.addColorStop(0, "#ffffff"),
      s.addColorStop(0.35, "#e2e2e2"),
      s.addColorStop(0.75, "#9a9a9a"),
      s.addColorStop(1, "#585858"),
      (o.fillStyle = s),
      o.fillRect(0, 0, 128, 128));
    const a = new ze(n);
    return ((a.colorSpace = me), a);
  })(),
  Oe = (() => {
    const n = document.createElement("canvas");
    n.width = n.height = 256;
    const o = n.getContext("2d"),
      s = o.createRadialGradient(
        256 / 2,
        256 / 2,
        0,
        256 / 2,
        256 / 2,
        256 / 2,
      );
    return (
      s.addColorStop(0, "rgba(255,255,255,0.9)"),
      s.addColorStop(0.45, "rgba(255,255,255,0.45)"),
      s.addColorStop(1, "rgba(255,255,255,0)"),
      (o.fillStyle = s),
      o.fillRect(0, 0, 256, 256),
      new ze(n)
    );
  })();
function Pt({
  x_deg: e,
  y_deg: n,
  color: o = "#ffffff",
  scale: s,
  dashed: a = !1,
  pulse: d = !0,
  interactive: i = !0,
  onClick: f,
}) {
  const [h, c] = t.useState(!1),
    [v, p] = t.useState(!1),
    u = t.useRef(),
    b = t.useRef(),
    y = t.useRef(),
    x = t.useRef(),
    m = t.useRef(),
    j = t.useRef(0),
    { position: S, quaternion: g } = t.useMemo(() => {
      const C = new ae(...$e(e, n)).multiplyScalar(St),
        E = C.clone().normalize().negate(),
        T = new ae(0, 1, 0),
        l = Math.acos(Z.clamp(T.dot(E), -1, 1)),
        I = Math.acos(Rt);
      if (l > I) {
        const _ = new ae().crossVectors(T, E);
        (_.lengthSq() < 1e-8 && _.set(1, 0, 0),
          _.normalize(),
          T.applyQuaternion(new Ce().setFromAxisAngle(_, l - I)));
      }
      const R = new ae(-E.x, 0, -E.z);
      (R.lengthSq() < 1e-6 && R.set(0, 0, -1),
        R.addScaledVector(T, -R.dot(T)).normalize());
      const P = new ae().crossVectors(R, T),
        ee = new Ce().setFromRotationMatrix(new dt().makeBasis(P, R, T));
      return { position: C, quaternion: ee };
    }, [e, n]);
  t.useEffect(
    () => () => {
      document.body.style.cursor = "";
    },
    [],
  );
  const w = (s == null ? void 0 : s.width) || 1,
    N = (s == null ? void 0 : s.height) || 1;
  ve((C, E) => {
    const T = u.current;
    if (!T) return;
    const l = h ? 1 : 0;
    j.current += (l - j.current) * Math.min(1, E * 10);
    const I = 1 + 0.12 * j.current;
    T.scale.set(pe * w * I, pe * N * I, pe * I);
    const R = C.clock.elapsedTime;
    if (
      (b.current && (b.current.position.z = Et + Math.sin(R * 2) * It),
      y.current)
    ) {
      const P = d ? 0.35 + 0.5 * (0.5 + 0.5 * Math.sin(R * 2.6)) : 0.8;
      y.current.opacity = P * (1 - j.current) + 1 * j.current;
    }
    (x.current && (x.current.opacity = 0.85 * j.current),
      m.current && (m.current.rotation.z = R * 0.4));
  });
  const U = (C) => {
      (C.stopPropagation(), !(C.delta > 8) && (f == null || f(C)));
    },
    O = (C) => {
      (C.stopPropagation(), c(!0), (document.body.style.cursor = "pointer"));
    },
    k = () => {
      (c(!1), p(!1), (document.body.style.cursor = ""));
    };
  return r.jsx("group", {
    position: S,
    quaternion: g,
    children: r.jsxs("group", {
      ref: u,
      children: [
        r.jsx("mesh", {
          geometry: Le,
          renderOrder: 4,
          "position-z": 0.005,
          scale: 0.85,
          children: r.jsx("meshBasicMaterial", {
            map: Oe,
            color: "#000000",
            transparent: !0,
            opacity: 0.35,
            depthWrite: !1,
          }),
        }),
        r.jsx("mesh", {
          geometry: Le,
          renderOrder: 5,
          "position-z": 0.01,
          children: r.jsx("meshBasicMaterial", {
            ref: x,
            map: Oe,
            color: o,
            transparent: !0,
            opacity: 0,
            depthWrite: !1,
          }),
        }),
        r.jsx("mesh", {
          ref: b,
          geometry: Lt,
          "rotation-x": 0.35,
          renderOrder: 6,
          children: r.jsx("meshMatcapMaterial", {
            ref: y,
            matcap: Ot,
            color: v ? Mt : o,
            transparent: !0,
          }),
        }),
        a &&
          r.jsx("group", {
            ref: m,
            children: _t.map((C) =>
              r.jsx(
                "mesh",
                {
                  geometry: Nt,
                  "rotation-z": C,
                  renderOrder: 6,
                  children: r.jsx("meshBasicMaterial", {
                    color: o,
                    transparent: !0,
                    opacity: 0.9,
                    depthWrite: !1,
                    side: Ne,
                  }),
                },
                C,
              ),
            ),
          }),
        i &&
          r.jsx("mesh", {
            geometry: Ct,
            renderOrder: 8,
            onClick: U,
            onPointerOver: O,
            onPointerOut: k,
            onPointerDown: () => p(!0),
            onPointerUp: () => p(!1),
            children: r.jsx("meshBasicMaterial", {
              transparent: !0,
              opacity: 0,
              depthWrite: !1,
              side: Ne,
            }),
          }),
      ],
    }),
  });
}
function At({ hotspot: e, onNavigate: n }) {
  const o = t.useCallback(() => {
    const s = e.transitionVideoUrl || null;
    n(
      e.targetNodeId,
      s,
      e.transitionId,
      e.videoInitialYawOffset ?? 0,
      e.transitionVideos || [],
      e.id,
    );
  }, [e, n]);
  return r.jsx(Pt, {
    x_deg: e.position2D.x_deg,
    y_deg: e.position2D.y_deg,
    color: e.color || "#ffffff",
    scale: e.scale,
    onClick: o,
  });
}
function ue(e, n = 1) {
  const o = /^#?([0-9a-f]{6})$/i.exec(e || "");
  if (!o) return `rgba(255,255,255,${n})`;
  const s = parseInt(o[1], 16);
  return `rgba(${(s >> 16) & 255},${(s >> 8) & 255},${s & 255},${n})`;
}
function Ut(e, n = 0.4) {
  const o = /^#?([0-9a-f]{6})$/i.exec(e);
  if (!o) return e;
  const s = parseInt(o[1], 16),
    a = (h) => Math.round(h * (1 - n)),
    d = a((s >> 16) & 255),
    i = a((s >> 8) & 255),
    f = a(s & 255);
  return `#${((d << 16) | (i << 8) | f).toString(16).padStart(6, "0")}`;
}
const qe = {
    Fa: () =>
      J(
        () => import("./index-DkIPaksv.js"),
        __vite__mapDeps([0, 1, 2]),
        import.meta.url,
      ),
    Fa6: () =>
      J(
        () => import("./index-Dlz6eCIb.js"),
        __vite__mapDeps([3, 1, 2]),
        import.meta.url,
      ),
    Io5: () =>
      J(
        () => import("./index-CyyoiMmg.js"),
        __vite__mapDeps([4, 1, 2]),
        import.meta.url,
      ),
    Io: () =>
      J(
        () => import("./index-DrfRWBTz.js"),
        __vite__mapDeps([5, 1, 2]),
        import.meta.url,
      ),
    Md: () =>
      J(
        () => import("./index-nVumfo3O.js"),
        __vite__mapDeps([6, 1, 2]),
        import.meta.url,
      ),
    Hi: () =>
      J(
        () => import("./index-Bj9eR4pF.js"),
        __vite__mapDeps([7, 1, 2]),
        import.meta.url,
      ),
    Bi: () =>
      J(
        () => import("./index-Dsn-lxFo.js"),
        __vite__mapDeps([8, 1, 2]),
        import.meta.url,
      ),
    Fi: () =>
      J(
        () => import("./index-BnR07znK.js"),
        __vite__mapDeps([9, 1, 2]),
        import.meta.url,
      ),
  },
  zt = Object.keys(qe).sort((e, n) => n.length - e.length),
  fe = {},
  de = {};
function Ye(e) {
  return (e && zt.find((n) => e.startsWith(n))) || null;
}
async function Vt(e) {
  var o;
  const n = Ye(e);
  return n
    ? (fe[n] ||
        (de[n] ||
          (de[n] = qe[n]()
            .then((s) => ((fe[n] = s), s))
            .catch(() => null)
            .finally(() => {
              delete de[n];
            })),
        await de[n]),
      ((o = fe[n]) == null ? void 0 : o[e]) || null)
    : null;
}
function Ft({ name: e, size: n = 24, color: o = "white", className: s = "" }) {
  const [a, d] = t.useState(() => {
    var f;
    const i = Ye(e);
    return (i && ((f = fe[i]) == null ? void 0 : f[e])) || null;
  });
  return (
    t.useEffect(() => {
      let i = !0;
      return (
        Vt(e).then((f) => {
          i && d(() => f);
        }),
        () => {
          i = !1;
        }
      );
    }, [e]),
    a
      ? r.jsx(a, { size: n, color: o, className: s })
      : r.jsx("span", {
          className: s,
          style: {
            display: "inline-block",
            width: n,
            height: n,
            borderRadius: "50%",
            background: o,
            opacity: 0.6,
          },
        })
  );
}
function Dt({ sign: e, onOpenPopup: n }) {
  var v;
  const [o, s] = t.useState(!1),
    a = $e(e.position2D.x_deg, e.position2D.y_deg),
    d = e.scale || { width: 1, height: 1 },
    i = 42 * d.width,
    f = e.appearance || {},
    h = (v = e.popupContent) == null ? void 0 : v.title,
    c = f.color || "#10c9b7";
  return r.jsx(ft, {
    position: a,
    center: !0,
    zIndexRange: [1, 10],
    style: { pointerEvents: "auto" },
    children: r.jsxs("div", {
      className: "relative flex items-center justify-center",
      children: [
        h &&
          r.jsx("div", {
            className: `absolute bottom-full mb-2 left-1/2 -translate-x-1/2 whitespace-nowrap
                        rounded-full bg-black/75 backdrop-blur-sm px-3 py-1 text-xs font-medium
                        text-white shadow-lg transition-all duration-200 pointer-events-none
                        ${o ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"}`,
            children: h,
          }),
        r.jsx("div", {
          onClick: (p) => {
            (p.stopPropagation(), n(e.popupContent, e.id));
          },
          onMouseEnter: () => s(!0),
          onMouseLeave: () => s(!1),
          className: `cursor-pointer flex items-center justify-center rounded-full
                     backdrop-blur-sm border-2 transition-all duration-200`,
          style: {
            width: i,
            height: i * ((d.height || 1) / (d.width || 1)),
            borderColor: o ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.55)",
            background: `radial-gradient(120% 120% at 30% 25%, ${ue(c, o ? 0.95 : 0.88)}, ${ue(Ut(c, 0.45), o ? 0.92 : 0.88)})`,
            transform: o ? "scale(1.12)" : "scale(1)",
            boxShadow: o
              ? `0 4px 16px rgba(0,0,0,0.4), 0 0 18px ${ue(c, 0.6)}`
              : `0 3px 10px rgba(0,0,0,0.4), 0 0 10px ${ue(c, 0.35)}`,
          },
          title: h || "Info",
          children: r.jsx(Ft, {
            name: f.assetUrl || "FaInfoCircle",
            size: i * 0.52,
            color: f.iconColor || "white",
          }),
        }),
      ],
    }),
  });
}
const he = 50,
  Pe = "/gateverse-logo.png",
  Bt = 28,
  Ae = -20;
function Ht(e, n) {
  const { gl: o } = Ve(),
    [s, a] = t.useState(null);
  return (
    t.useEffect(() => {
      let d = !0,
        i = null,
        f = null,
        h = !1;
      const c = new Be(),
        v = (p) => (
          (p.colorSpace = me),
          (p.wrapS = De),
          (p.repeat.x = -1),
          (p.offset.x = 1),
          (p.anisotropy = Math.min(8, o.capabilities.getMaxAnisotropy())),
          p
        );
      return (
        n &&
          c.load(n, (p) => {
            if (!d || h) return p.dispose();
            ((i = v(p)), a(i), V());
          }),
        c.load(
          e,
          (p) => {
            if (!d) return p.dispose();
            ((h = !0), (f = v(p)), a(f), i && (i.dispose(), (i = null)), V());
          },
          void 0,
          () => console.error("Panorama failed to load:", e),
        ),
        () => {
          ((d = !1), a(null), i && i.dispose(), f && f.dispose());
        }
      );
    }, [e, n, o]),
    s
  );
}
function xe({
  panoramaUrl: e,
  previewUrl: n,
  opacity: o = 1,
  initialOpacity: s = 0,
  onFadeComplete: a,
  onFadeInComplete: d,
  yawOffset: i = 0,
  customSphere: f = he,
}) {
  const h = Ht(e, n),
    c = t.useRef(s),
    v = t.useRef(),
    p = t.useRef(),
    u = t.useRef(a),
    b = t.useRef(d),
    y = !!h,
    x = t.useRef(!1),
    m = t.useRef(o);
  (t.useEffect(() => {
    ((u.current = a), (b.current = d));
  }),
    t.useEffect(() => {
      m.current !== o && ((m.current = o), (x.current = !1), V());
    }, [o]),
    t.useEffect(() => {
      y && V();
    }, [y]),
    ve(() => {
      if (x.current) return;
      const w = o,
        N = c.current;
      v.current &&
        y &&
        (Math.abs(N - w) > 0.001
          ? ((c.current += (w - N) * 0.05),
            (v.current.opacity = c.current),
            V())
          : (N !== w &&
              ((c.current = w),
              (v.current.opacity = w),
              w === 0 && u.current
                ? u.current()
                : w === 1 && b.current && b.current()),
            (x.current = !0)));
    }));
  const j = Z.degToRad(i);
  if (!y) return null;
  const g = o > c.current && c.current < 0.95 ? f - 0.02 : f;
  return r.jsxs("mesh", {
    ref: p,
    rotation: [0, j, 0],
    children: [
      r.jsx("sphereGeometry", { args: [g, 128, 64] }),
      r.jsx("meshBasicMaterial", {
        ref: v,
        map: h,
        side: Fe,
        transparent: !0,
        opacity: c.current,
      }),
    ],
  });
}
function $t({
  preservedCameraYaw: e = null,
  preservedCameraPitch: n = null,
  onYawChange: o,
  onPitchChange: s,
}) {
  const { camera: a, gl: d } = Ve(),
    i = t.useRef(!1),
    f = t.useRef({ x: 0, y: 0 }),
    h = t.useRef(new mt(0, 0, 0, "YXZ")),
    c = t.useRef(o),
    v = t.useRef(s),
    p = t.useRef({ x: 0, y: 0 }),
    u = t.useRef(0),
    b = t.useRef(0),
    y = 35,
    x = 90,
    m = Z.degToRad(85);
  t.useEffect(() => {
    ((c.current = o), (v.current = s));
  });
  const j = t.useCallback(() => {
      var l, I;
      (a.quaternion.setFromEuler(h.current),
        V(),
        (l = c.current) == null || l.call(c, h.current.y),
        (I = v.current) == null || I.call(v, h.current.x));
    }, [a]),
    S = t.useCallback(() => {
      (cancelAnimationFrame(u.current), (p.current = { x: 0, y: 0 }));
    }, []),
    g = t.useCallback(() => {
      cancelAnimationFrame(u.current);
      const l = () => {
        ((p.current.x *= 0.94),
          (p.current.y *= 0.94),
          !(Math.abs(p.current.x) < 2e-4 && Math.abs(p.current.y) < 2e-4) &&
            ((h.current.y += p.current.y),
            (h.current.x = Math.max(
              -m,
              Math.min(m, h.current.x + p.current.x),
            )),
            j(),
            (u.current = requestAnimationFrame(l))));
      };
      u.current = requestAnimationFrame(l);
    }, [j, m]),
    w = t.useCallback(
      (l) => {
        ((a.fov = Z.clamp(a.fov + l, y, x)), a.updateProjectionMatrix(), V());
      },
      [a],
    ),
    N = t.useCallback(
      (l) => {
        (l.preventDefault(), w(l.deltaY * 0.03));
      },
      [w],
    );
  t.useEffect(() => {
    var I, R;
    let l = !1;
    (e !== null && h.current.y !== e
      ? ((h.current.y = e), (l = !0))
      : e === null && h.current.y !== 0 && ((h.current.y = 0), (l = !0)),
      n !== null && h.current.x !== n
        ? ((h.current.x = n), (l = !0))
        : n === null && h.current.x !== 0 && ((h.current.x = 0), (l = !0)),
      l &&
        (a.quaternion.setFromEuler(h.current),
        V(),
        (I = c.current) == null || I.call(c, h.current.y),
        (R = v.current) == null || R.call(v, h.current.x)));
  }, [a, e, n]);
  const U = t.useCallback(
      (l) => {
        (l.preventDefault(),
          S(),
          (i.current = !0),
          (f.current = { x: l.clientX, y: l.clientY }),
          l.target.setPointerCapture(l.pointerId));
      },
      [S],
    ),
    O = t.useCallback(
      (l) => {
        if (!i.current) return;
        const I = l.clientX - f.current.x,
          R = l.clientY - f.current.y;
        f.current = { x: l.clientX, y: l.clientY };
        const P = 0.003 * (a.fov / 65);
        ((h.current.y -= I * P),
          (h.current.x -= R * P),
          (h.current.x = Math.max(-m, Math.min(m, h.current.x))),
          (p.current = { y: -I * P, x: -R * P }),
          j());
      },
      [a, j, m],
    ),
    k = t.useCallback(
      (l) => {
        var I, R, P;
        i.current &&
          ((i.current = !1),
          (I = c.current) == null || I.call(c, h.current.y),
          (R = v.current) == null || R.call(v, h.current.x),
          g(),
          (P = l == null ? void 0 : l.target) != null &&
            P.releasePointerCapture &&
            l.target.releasePointerCapture(l.pointerId));
      },
      [g],
    ),
    C = t.useCallback(
      (l) => {
        if ((S(), l.touches.length === 2)) {
          ((i.current = !1),
            (b.current = Math.hypot(
              l.touches[0].clientX - l.touches[1].clientX,
              l.touches[0].clientY - l.touches[1].clientY,
            )));
          return;
        }
        const I = l.touches[0];
        ((i.current = !0), (f.current = { x: I.clientX, y: I.clientY }));
      },
      [S],
    ),
    E = t.useCallback(
      (l) => {
        if (l.touches.length === 2) {
          const R = Math.hypot(
            l.touches[0].clientX - l.touches[1].clientX,
            l.touches[0].clientY - l.touches[1].clientY,
          );
          (b.current > 0 && w((b.current - R) * 0.2), (b.current = R));
          return;
        }
        const I = l.touches[0];
        O({ clientX: I.clientX, clientY: I.clientY });
      },
      [O, w],
    ),
    T = t.useCallback(
      (l) => {
        var I, R, P;
        ((b.current = 0),
          i.current &&
            (((I = l == null ? void 0 : l.touches) == null
              ? void 0
              : I.length) > 0 ||
              ((i.current = !1),
              (R = c.current) == null || R.call(c, h.current.y),
              (P = v.current) == null || P.call(v, h.current.x),
              g())));
      },
      [g],
    );
  return (
    t.useEffect(() => {
      const l = d.domElement;
      return (
        l.addEventListener("pointerdown", U),
        l.addEventListener("pointermove", O),
        l.addEventListener("pointerup", k),
        l.addEventListener("wheel", N, { passive: !1 }),
        l.addEventListener("touchstart", C, { passive: !0 }),
        l.addEventListener("touchmove", E, { passive: !0 }),
        l.addEventListener("touchend", T),
        () => {
          (cancelAnimationFrame(u.current),
            l.removeEventListener("pointerdown", U),
            l.removeEventListener("pointermove", O),
            l.removeEventListener("pointerup", k),
            l.removeEventListener("wheel", N),
            l.removeEventListener("touchstart", C),
            l.removeEventListener("touchmove", E),
            l.removeEventListener("touchend", T));
        }
      );
    }, [d.domElement, U, O, k, N, C, E, T]),
    null
  );
}
function Wt({
  videoUrl: e,
  onEnded: n,
  onFadeComplete: o,
  textureYawOffset: s = 0,
}) {
  const [a, d] = t.useState(null),
    i = t.useRef(0),
    f = t.useRef(!1),
    h = t.useRef(!1),
    c = t.useRef(!1),
    v = t.useRef(),
    p = t.useRef(),
    u = t.useRef(n),
    b = t.useRef(o);
  t.useEffect(() => {
    ((u.current = n), (b.current = o));
  });
  const y = t.useRef(!1),
    x = t.useRef(!1);
  ve(() => {
    var S, g;
    y.current ||
      (!x.current && a && (a.needsUpdate = !0),
      v.current &&
        (f.current
          ? (h.current ||
              ((h.current = !0), (S = u.current) == null || S.call(u)),
            c.current ||
              ((v.current.opacity = i.current),
              (c.current = !0),
              (g = b.current) == null || g.call(b)),
            (y.current = !0))
          : i.current < 1
            ? ((i.current = Math.min(1, i.current + 0.05)),
              (v.current.opacity = i.current),
              V())
            : x.current || V()));
  });
  const m = t.useCallback(() => {
    ((y.current = !1), V());
  }, []);
  if (
    (t.useEffect(() => {
      let S = !0;
      ((i.current = 0),
        (f.current = !1),
        (h.current = !1),
        (c.current = !1),
        (y.current = !1));
      const g = document.createElement("video");
      ((g.muted = !0), (g.playsInline = !0), (g.preload = "auto"));
      const w = new pt(g);
      ((w.wrapS = De),
        (w.repeat.x = -1),
        (w.offset.x = 1),
        (w.colorSpace = me));
      let N = null;
      const U = () => {
          ((w.needsUpdate = !0), V(), (N = g.requestVideoFrameCallback(U)));
        },
        O = () => {
          S &&
            (d(w),
            typeof g.requestVideoFrameCallback == "function" &&
              ((x.current = !0), (N = g.requestVideoFrameCallback(U))),
            V());
        },
        k = () => {
          S && ((f.current = !0), m());
        },
        C = () => {
          var T;
          S &&
            (console.error("Transition video failed:", e),
            (T = u.current) == null || T.call(u));
        };
      (g.addEventListener("playing", O, { once: !0 }),
        g.addEventListener("ended", k),
        g.addEventListener("error", C),
        (g.src = e));
      const E = g.play();
      return (
        E &&
          E.catch((T) => {
            var l;
            S &&
              T.name !== "AbortError" &&
              (console.error("Transition video play rejected:", T),
              (l = u.current) == null || l.call(u));
          }),
        () => {
          ((S = !1),
            N &&
              typeof g.cancelVideoFrameCallback == "function" &&
              g.cancelVideoFrameCallback(N),
            (x.current = !1),
            g.removeEventListener("playing", O),
            g.removeEventListener("ended", k),
            g.removeEventListener("error", C),
            d(null),
            g.pause(),
            (g.src = ""),
            w.dispose());
        }
      );
    }, [e, s, m]),
    !a)
  )
    return null;
  const j = Z.degToRad(s);
  return r.jsxs("mesh", {
    ref: p,
    rotation: [0, j, 0],
    children: [
      r.jsx("sphereGeometry", { args: [he - 0.1, 128, 64] }),
      r.jsx("meshBasicMaterial", {
        ref: v,
        map: a,
        side: Fe,
        transparent: !0,
        opacity: 0,
      }),
    ],
  });
}
function Gt({ url: e }) {
  const [n, o] = t.useState(null);
  if (
    (t.useEffect(() => {
      let a = !0,
        d = null;
      const i = new Be(),
        f = (c) => {
          if (!a) return c.dispose();
          ((c.colorSpace = me), (d = c), o(c), V());
        },
        h = () =>
          i.load(Pe, f, void 0, () =>
            console.error("Nadir logo failed to load:", Pe),
          );
      return (
        e ? i.load(e, f, void 0, h) : h(),
        () => {
          ((a = !1), o(null), d && d.dispose());
        }
      );
    }, [e]),
    !n)
  )
    return null;
  const s = Math.abs(Ae) * Math.tan(Z.degToRad(Bt));
  return r.jsxs("mesh", {
    position: [0, Ae - 25, 0],
    rotation: [-Math.PI / 2, 0, 0],
    children: [
      r.jsx("circleGeometry", { args: [s - 5, 64] }),
      r.jsx("meshBasicMaterial", { map: n, transparent: !0 }),
    ],
  });
}
function qt({
  node: e,
  previousNode: n,
  transitionBackdrops: o,
  hotspotVisible: s,
  onNavigate: a,
  onSignClick: d,
  preservedCameraYaw: i,
  preservedCameraPitch: f,
  onYawChange: h,
  onPitchChange: c,
  transitionVideoUrl: v,
  onTransitionComplete: p,
  onVideoFadeComplete: u,
  videoTextureYawOffset: b,
  panoramaOpacity: y,
  onPanoramaFadeInComplete: x,
  videoQueueIndex: m,
  nadirLogoUrl: j,
}) {
  var S, g;
  return r.jsxs(r.Fragment, {
    children: [
      r.jsx($t, {
        preservedCameraYaw: i,
        preservedCameraPitch: f,
        onYawChange: h,
        onPitchChange: c,
      }),
      n &&
        r.jsx(
          t.Suspense,
          {
            fallback: null,
            children: r.jsx(xe, {
              panoramaUrl: n.panoramaUrl,
              previewUrl: n.panoramaPreviewUrl,
              opacity: 1,
              initialOpacity: 1,
              yawOffset: n.initialYawOffset || 0,
              customSphere: he + 0.05,
            }),
          },
          `prev-${n.id}`,
        ),
      o == null
        ? void 0
        : o.map(({ node: w, radiusOffset: N }) =>
            r.jsx(
              t.Suspense,
              {
                fallback: null,
                children: r.jsx(xe, {
                  panoramaUrl: w.panoramaUrl,
                  previewUrl: w.panoramaPreviewUrl,
                  opacity: 1,
                  yawOffset: w.initialYawOffset || 0,
                  customSphere: he + N,
                }),
              },
              `backdrop-${w.id}`,
            ),
          ),
      r.jsx(
        xe,
        {
          panoramaUrl: e.panoramaUrl,
          previewUrl: e.panoramaPreviewUrl,
          opacity: y,
          onFadeInComplete: x,
          yawOffset: e.initialYawOffset || 0,
        },
        e.id,
      ),
      v &&
        r.jsx(
          Wt,
          {
            videoUrl: v,
            onEnded: p,
            onFadeComplete: u,
            textureYawOffset: b || 0,
          },
          `video-${m ?? 0}-${v}`,
        ),
      r.jsx(Gt, { url: j }),
      r.jsxs("group", {
        rotation: [0, Z.degToRad(e.initialYawOffset || 0), 0],
        children: [
          s &&
            ((S = e.navigationHotspots) == null
              ? void 0
              : S.map((w) => r.jsx(At, { hotspot: w, onNavigate: a }, w.id))),
          s &&
            ((g = e.infoSigns) == null
              ? void 0
              : g.map((w) => r.jsx(Dt, { sign: w, onOpenPopup: d }, w.id))),
        ],
      }),
    ],
  });
}
function Yt({
  node: e,
  transitionBackdrops: n,
  hotspotVisible: o,
  onNavigate: s,
  onSignClick: a,
  preservedCameraYaw: d,
  preservedCameraPitch: i,
  onYawChange: f,
  onPitchChange: h,
  transitionVideoUrl: c,
  onTransitionComplete: v,
  onVideoFadeComplete: p,
  videoTextureYawOffset: u,
  spotHasVideo: b,
  videoQueueIndex: y,
  nadirLogoUrl: x,
}) {
  const [m, j] = t.useState(e),
    [S, g] = t.useState(null),
    [w, N] = t.useState(1),
    U = t.useRef(c);
  (e &&
    e !== m &&
    (m &&
      e.id !== m.id &&
      (!b && !c
        ? (g({
            id: m.id,
            panoramaUrl: m.panoramaUrl,
            panoramaPreviewUrl: m.panoramaPreviewUrl,
            initialYawOffset: m.initialYawOffset,
          }),
          N(1))
        : g(null)),
    j(e)),
    t.useEffect(() => {
      const k = U.current,
        C = c;
      (C ? g(null) : k && !C && N(1), (U.current = c));
    }, [c]));
  const O = t.useCallback(() => {
    g(null);
  }, []);
  return e
    ? r.jsx(ht, {
        frameloop: "demand",
        dpr: [1, 2],
        camera: { fov: 65, near: 0.1, far: 200, position: [0, 0, 0.01] },
        style: {
          width: "100%",
          height: "100%",
          background: "#000",
          userSelect: "none",
          WebkitUserSelect: "none",
          WebkitUserDrag: "none",
        },
        onDragStart: (k) => k.preventDefault(),
        gl: { antialias: !0 },
        children: r.jsx(qt, {
          node: e,
          previousNode: S,
          transitionBackdrops: n,
          hotspotVisible: o,
          onNavigate: s,
          onSignClick: a,
          preservedCameraYaw: d,
          preservedCameraPitch: i,
          onYawChange: f,
          onPitchChange: h,
          transitionVideoUrl: c,
          onTransitionComplete: v,
          onVideoFadeComplete: p,
          videoTextureYawOffset: u,
          panoramaOpacity: w,
          onPanoramaFadeInComplete: O,
          videoQueueIndex: y,
          nadirLogoUrl: x,
        }),
      })
    : null;
}
const ie = ({
    size: e = 24,
    color: n = "currentColor",
    className: o = "",
    children: s,
    viewBox: a = "0 0 24 24",
  }) =>
    r.jsx("svg", {
      width: e,
      height: e,
      viewBox: a,
      fill: "none",
      stroke: n,
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      className: o,
      children: s,
    }),
  Xt = (e) =>
    r.jsx(ie, {
      ...e,
      children: r.jsx("path", { d: "M4 6h16M4 12h16M4 18h16" }),
    }),
  Qt = (e) =>
    r.jsx(ie, { ...e, children: r.jsx("path", { d: "M6 6l12 12M18 6L6 18" }) }),
  Jt = (e) =>
    r.jsxs(ie, {
      ...e,
      children: [
        r.jsx("path", {
          d: "M11 5 6 9H3v6h3l5 4V5z",
          fill: e.color || "currentColor",
          stroke: "none",
        }),
        r.jsx("path", { d: "M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" }),
      ],
    }),
  Kt = (e) =>
    r.jsxs(ie, {
      ...e,
      children: [
        r.jsx("path", {
          d: "M11 5 6 9H3v6h3l5 4V5z",
          fill: e.color || "currentColor",
          stroke: "none",
        }),
        r.jsx("path", { d: "M16 9l6 6M22 9l-6 6" }),
      ],
    }),
  Zt = (e) =>
    r.jsxs(ie, {
      ...e,
      children: [
        r.jsx("path", {
          d: "M12 21s-7-5.75-7-11a7 7 0 1 1 14 0c0 5.25-7 11-7 11z",
        }),
        r.jsx("circle", { cx: "12", cy: "10", r: "2.5" }),
      ],
    });
function er({
  nodes: e,
  activeNodeId: n,
  onNavigate: o,
  audioMuted: s,
  onToggleAudio: a,
  audioEnabled: d,
}) {
  const [i, f] = t.useState(!1),
    h = e ? Object.values(e) : [];
  return r.jsxs(r.Fragment, {
    children: [
      r.jsx("button", {
        onClick: () => f((c) => !c),
        className: `absolute top-4 left-4 z-40 w-10 h-10 flex items-center justify-center\r
                   rounded-full bg-black/50 backdrop-blur-sm border border-white/20\r
                   text-white hover:bg-black/70 transition-colors`,
        "aria-label": "Toggle navigation menu",
        children: i ? r.jsx(Qt, { size: 18 }) : r.jsx(Xt, { size: 18 }),
      }),
      r.jsxs("div", {
        className: `absolute top-0 left-0 h-full z-30 w-72 bg-black/80 backdrop-blur-md
                    border-r border-white/10 text-white flex flex-col
                    transition-transform duration-300 ease-in-out
                    ${i ? "translate-x-0" : "-translate-x-full"}`,
        children: [
          r.jsx("div", {
            className:
              "flex items-center justify-between p-4 pt-16 border-b border-white/10",
            children: r.jsx("h2", {
              className:
                "font-semibold text-sm uppercase tracking-widest text-gray-300",
              children: "Locations",
            }),
          }),
          r.jsx("div", {
            className: "flex-1 overflow-y-auto py-2",
            children: h.map((c) =>
              r.jsxs(
                "button",
                {
                  onClick: () => {
                    (o(c.id), f(!1));
                  },
                  className: `w-full flex items-center gap-3 px-4 py-3 text-left
                          hover:bg-white/10 transition-colors
                          ${c.id === n ? "bg-white/15 text-white" : "text-gray-300"}`,
                  children: [
                    c.panoramaPreviewUrl
                      ? r.jsx("img", {
                          src: c.panoramaPreviewUrl,
                          alt: "",
                          loading: "lazy",
                          className: `w-14 h-9 rounded object-cover flex-shrink-0 border
                              ${c.id === n ? "border-blue-400" : "border-white/10"}`,
                        })
                      : r.jsx(Zt, {
                          size: 14,
                          className:
                            c.id === n ? "text-blue-400" : "text-gray-500",
                        }),
                    r.jsx("span", {
                      className: "text-sm truncate",
                      children: c.displayName,
                    }),
                    c.id === n &&
                      r.jsx("span", {
                        className: "ml-auto text-xs text-blue-400 font-medium",
                        children: "Now",
                      }),
                  ],
                },
                c.id,
              ),
            ),
          }),
          d &&
            r.jsx("div", {
              className: "p-4 border-t border-white/10",
              children: r.jsxs("button", {
                onClick: a,
                className: `w-full flex items-center gap-3 px-3 py-2 rounded-lg\r
                         bg-white/10 hover:bg-white/15 transition-colors text-sm`,
                children: [
                  s
                    ? r.jsx(Kt, { size: 16, className: "text-red-400" })
                    : r.jsx(Jt, { size: 16, className: "text-green-400" }),
                  r.jsx("span", {
                    children: s
                      ? "Unmute Background Audio"
                      : "Mute Background Audio",
                  }),
                ],
              }),
            }),
        ],
      }),
      i &&
        r.jsx("div", {
          className: "absolute inset-0 z-20",
          onClick: () => f(!1),
        }),
    ],
  });
}
Ue.addHook("afterSanitizeAttributes", (e) => {
  e.tagName === "A" &&
    e.getAttribute("target") === "_blank" &&
    e.setAttribute("rel", "noopener noreferrer");
});
function tr({ content: e, onClose: n }) {
  const o = t.useRef(null);
  t.useEffect(() => {
    const d = (i) => {
      i.key === "Escape" && n();
    };
    return (
      window.addEventListener("keydown", d),
      () => window.removeEventListener("keydown", d)
    );
  }, [n]);
  const s = (d) => {
      d.target === o.current && n();
    },
    a = t.useMemo(
      () =>
        Ue.sanitize((e == null ? void 0 : e.htmlContent) || "", {
          ALLOWED_TAGS: [
            "div",
            "p",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "span",
            "ul",
            "ol",
            "li",
            "strong",
            "em",
            "b",
            "i",
            "a",
            "br",
            "table",
            "thead",
            "tbody",
            "tr",
            "th",
            "td",
            "img",
            "figure",
            "figcaption",
            "blockquote",
            "code",
            "pre",
          ],
          ALLOWED_ATTR: [
            "class",
            "style",
            "href",
            "src",
            "alt",
            "title",
            "target",
          ],
          FORCE_BODY: !0,
        }),
      [e == null ? void 0 : e.htmlContent],
    );
  return r.jsx("div", {
    ref: o,
    onClick: s,
    className:
      "fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm",
    style: { pointerEvents: "all" },
    children: r.jsxs("div", {
      className: `relative bg-gray-900 text-white rounded-2xl shadow-2xl max-w-lg w-full mx-4\r
                   max-h-[80vh] flex flex-col overflow-hidden\r
                   animate-[fadeInScale_0.2s_ease-out]`,
      onClick: (d) => d.stopPropagation(),
      children: [
        r.jsx("button", {
          onClick: n,
          className: `absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center\r
                     rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white\r
                     text-lg font-bold`,
          "aria-label": "Close",
          children: "×",
        }),
        (e == null ? void 0 : e.coverImage) &&
          r.jsx("div", {
            className: "w-full h-48 flex-shrink-0 overflow-hidden",
            children: r.jsx("img", {
              src: e.coverImage,
              alt: e == null ? void 0 : e.title,
              className: "w-full h-full object-cover",
            }),
          }),
        r.jsxs("div", {
          className: "flex-1 overflow-y-auto p-6",
          children: [
            (e == null ? void 0 : e.title) &&
              r.jsx("h2", {
                className: "text-xl font-bold mb-4 text-white",
                children: e.title,
              }),
            a &&
              r.jsx("div", {
                className: "prose prose-invert prose-sm max-w-none",
                dangerouslySetInnerHTML: { __html: a },
              }),
          ],
        }),
      ],
    }),
  });
}
const rr = "/api";
function nr({ tourId: e, nodeId: n, onClose: o }) {
  const [s, a] = t.useState(""),
    [d, i] = t.useState(""),
    [f, h] = t.useState(""),
    [c, v] = t.useState(!1),
    [p, u] = t.useState(!1),
    [b, y] = t.useState(""),
    x = async (m) => {
      (m.preventDefault(), v(!0), y(""));
      try {
        const j = await fetch(`${rr}/messages/${e}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: s, email: d, message: f, nodeId: n }),
        });
        if (!j.ok) {
          const S = await j.json().catch(() => null);
          throw new Error(
            (S == null ? void 0 : S.message) || "Could not send your message",
          );
        }
        u(!0);
      } catch (j) {
        y(j.message);
      } finally {
        v(!1);
      }
    };
  return r.jsx("div", {
    className:
      "absolute inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4",
    onClick: o,
    children: r.jsx("div", {
      className:
        "w-full max-w-sm rounded-2xl bg-gray-900/95 border border-white/10 p-6 shadow-2xl",
      onClick: (m) => m.stopPropagation(),
      children: p
        ? r.jsxs("div", {
            className: "flex flex-col items-center gap-3 text-center py-4",
            children: [
              r.jsxs("svg", {
                width: "40",
                height: "40",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "#2dd4bf",
                strokeWidth: "2",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                children: [
                  r.jsx("path", { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14" }),
                  r.jsx("path", { d: "M22 4 12 14.01l-3-3" }),
                ],
              }),
              r.jsx("p", {
                className: "text-white font-medium",
                children: "Message sent",
              }),
              r.jsx("p", {
                className: "text-white/50 text-sm",
                children: "Thank you — the tour owner will see your message.",
              }),
              r.jsx("button", {
                onClick: o,
                className:
                  "mt-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition-colors",
                children: "Close",
              }),
            ],
          })
        : r.jsxs("form", {
            onSubmit: x,
            className: "flex flex-col gap-3",
            children: [
              r.jsxs("div", {
                className: "flex items-center justify-between mb-1",
                children: [
                  r.jsx("h2", {
                    className: "text-white font-semibold",
                    children: "Leave a message",
                  }),
                  r.jsx("button", {
                    type: "button",
                    onClick: o,
                    "aria-label": "Close",
                    className:
                      "text-white/50 hover:text-white transition-colors",
                    children: r.jsx("svg", {
                      width: "18",
                      height: "18",
                      viewBox: "0 0 24 24",
                      fill: "none",
                      stroke: "currentColor",
                      strokeWidth: "2",
                      strokeLinecap: "round",
                      children: r.jsx("path", { d: "M18 6 6 18M6 6l12 12" }),
                    }),
                  }),
                ],
              }),
              r.jsx("input", {
                className:
                  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500",
                placeholder: "Your name",
                value: s,
                required: !0,
                maxLength: 100,
                onChange: (m) => a(m.target.value),
              }),
              r.jsx("input", {
                className:
                  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500",
                type: "email",
                placeholder: "Email (optional, for a reply)",
                value: d,
                maxLength: 200,
                onChange: (m) => i(m.target.value),
              }),
              r.jsx("textarea", {
                className:
                  "bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/40 focus:outline-none focus:border-teal-500 resize-none",
                placeholder: "Your message…",
                rows: 4,
                value: f,
                required: !0,
                maxLength: 2e3,
                onChange: (m) => h(m.target.value),
              }),
              b &&
                r.jsx("p", { className: "text-red-400 text-sm", children: b }),
              r.jsx("button", {
                disabled: c,
                className:
                  "bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors",
                children: c ? "Sending…" : "Send message",
              }),
            ],
          }),
    }),
  });
}
const sr = 250;
function or({ projectId: e }) {
  var ye, we, je;
  const [n, o] = t.useState(null),
    s = t.useRef(null),
    a = t.useRef(0),
    d = t.useRef(0),
    [i, f] = t.useState(null),
    [h, c] = t.useState(null),
    [v, p] = t.useState(!1),
    [u, b] = t.useState(!1),
    [y, x] = t.useState(!1),
    m = t.useRef(null),
    [j, S] = t.useState(!1),
    [g, w] = t.useState(!0),
    [N, U] = t.useState(!1);
  (t.useEffect(() => {
    const M = () => S(!!document.fullscreenElement);
    return (
      document.addEventListener("fullscreenchange", M),
      () => document.removeEventListener("fullscreenchange", M)
    );
  }, []),
    t.useEffect(() => {
      if (!g) return;
      const M = () => w(!1);
      window.addEventListener("pointerdown", M, { once: !0 });
      const A = setTimeout(M, 8e3);
      return () => {
        (clearTimeout(A), window.removeEventListener("pointerdown", M));
      };
    }, [g]));
  const O = () => {
      var M, A, Y;
      document.fullscreenElement
        ? (Y = document.exitFullscreen) == null || Y.call(document)
        : (A = (M = m.current) == null ? void 0 : M.requestFullscreen) ==
            null || A.call(M).catch(() => {});
    },
    {
      project: k,
      activeNode: C,
      activeNodeId: E,
      loading: T,
      error: l,
      errorReason: I,
      transition: R,
      hotspotVisible: P,
      audioMuted: ee,
      toggleAudio: _,
      navigateTo: B,
      cancelTransition: L,
      onTransitionComplete: q,
      setActiveNodeId: Q,
      preloadNextAssets: W,
      videoQueue: z,
      videoQueueIndex: G,
    } = bt(e),
    re = jt(e, !!k),
    be = t.useRef(null);
  t.useEffect(() => {
    E &&
      (re("scene_view", { nodeId: E, targetId: be.current || "" }),
      (be.current = E));
  }, [E, re]);
  const ne = (R && z.length > 0 && z[G]) || null,
    Xe = (ne == null ? void 0 : ne.videoUrl) ?? null,
    Qe = ne ? (ne.yawOffset ?? 0) : null,
    ce = t.useRef(null),
    Je = t.useMemo(() => {
      var se, oe;
      if (!(k != null && k.nodes)) return [];
      if (!(R != null && R.targetNodeId)) {
        const H = ce.current;
        return H && H.node.id === E ? [H] : [];
      }
      if (z.length === 0) {
        const H = k.nodes[R.targetNodeId];
        return H
          ? ((ce.current = { node: H, radiusOffset: 0.05 }), [ce.current])
          : [];
      }
      const M = (se = z[G]) == null ? void 0 : se.startNodeId,
        A = k.nodes[M] || k.nodes[E] || null,
        Y =
          ((oe = z[G + 1]) == null ? void 0 : oe.startNodeId) || R.targetNodeId,
        K = k.nodes[Y] || k.nodes[R.targetNodeId] || null,
        te = [];
      if (
        (A && te.push({ node: A, radiusOffset: 0.1 }),
        K && K.id !== (A == null ? void 0 : A.id))
      ) {
        const H = { node: K, radiusOffset: 0.05 };
        ((ce.current = H), te.push(H));
      }
      return te;
    }, [
      R == null ? void 0 : R.targetNodeId,
      k == null ? void 0 : k.nodes,
      z,
      G,
      E,
    ]),
    Ke = async (M, A, Y, K = 0, te = [], se = "") => {
      var Ee, Ie;
      if (!k || u) return;
      (b(!0), se && re("hotspot_click", { nodeId: E, targetId: se }));
      const oe = (Ee = k.nodes) == null ? void 0 : Ee[M],
        H = (F, D, $ = "") =>
          F ? { videoUrl: F, yawOffset: D ?? 0, startNodeId: $ } : null;
      let X = [];
      if (te.length > 0)
        X = [...te]
          .sort((D, $) => D.order - $.order)
          .map((D) => H(D.videoUrl, D.yawOffset, D.startNodeId || ""))
          .filter(Boolean);
      else {
        const F = (Ie = k.transitions) == null ? void 0 : Ie[Y],
          D = A || (F == null ? void 0 : F.videoUrl) || null,
          $ = H(D, K);
        $ && (X = [$]);
      }
      const ke = (F) => {
        var $, Me;
        const D = (($ = X[F + 1]) == null ? void 0 : $.startNodeId) || M;
        return ((Me = k.nodes) == null ? void 0 : Me[D]) || oe;
      };
      try {
        X.length > 0
          ? (await W(ke(0), { videoUrl: X[0].videoUrl }),
            X.slice(1).forEach((F, D) => {
              const $ = D + 1;
              W(ke($), { videoUrl: F.videoUrl }).catch(() => {});
            }))
          : await W(oe, null);
      } catch (F) {
        console.error("Pre-render failed:", F);
      } finally {
        b(!1);
      }
      const Se = a.current,
        Re = d.current;
      X.length > 0
        ? (f(Se), c(Re), p(!0), B(M, X[0].videoUrl, X))
        : (f(Se), c(Re), p(!1), L(), Q(M));
    },
    Ze = async (M) => {
      var Y;
      if (M === E || !k || u) return;
      (L(), p(!1));
      const A = (Y = k.nodes) == null ? void 0 : Y[M];
      b(!0);
      try {
        await W(A, null);
      } catch (K) {
        console.error("Preload failed:", K);
      } finally {
        b(!1);
      }
      Q(M);
    },
    et = () => {
      (f(a.current), c(d.current), q());
    },
    tt = () => {};
  if (T)
    return r.jsx("div", {
      className: "flex h-full items-center justify-center bg-black",
      children: r.jsxs("div", {
        className: "flex flex-col items-center gap-4",
        children: [
          r.jsx("div", {
            className:
              "w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin",
          }),
          r.jsx("p", {
            className: "text-white/60 text-sm",
            children: "Loading tour…",
          }),
        ],
      }),
    });
  if (l) {
    const M = {
      subscription_expired:
        "The subscription for this virtual tour has ended. If you are the tour owner, please contact your provider to renew it.",
      project_expired:
        "Access to this virtual tour has ended. If you are the tour owner, please contact your provider to renew it.",
      project_suspended:
        "This virtual tour has been temporarily suspended. If you are the tour owner, please contact your provider.",
    }[I];
    return M
      ? r.jsxs("div", {
          className:
            "flex h-full flex-col items-center justify-center bg-black gap-4 px-6 text-center",
          children: [
            r.jsxs("svg", {
              width: "48",
              height: "48",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "1.5",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              className: "text-white/30",
              children: [
                r.jsx("rect", {
                  x: "3",
                  y: "11",
                  width: "18",
                  height: "10",
                  rx: "2",
                }),
                r.jsx("path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }),
              ],
            }),
            r.jsx("p", {
              className: "text-white text-xl font-semibold",
              children: "This tour is currently unavailable",
            }),
            r.jsx("p", {
              className: "text-white/50 text-sm max-w-md",
              children: M,
            }),
          ],
        })
      : r.jsx("div", {
          className: "flex h-full items-center justify-center bg-black",
          children: r.jsx("p", {
            className: "text-red-400 text-lg",
            children: l,
          }),
        });
  }
  if (!C) return null;
  const rt = !!(
    (we =
      (ye = k == null ? void 0 : k.settings) == null
        ? void 0
        : ye.globalBackgroundAudio) != null && we.src
  );
  return r.jsxs("div", {
    ref: m,
    className: "relative w-full h-full bg-black no-select overflow-hidden",
    children: [
      r.jsx(Yt, {
        node: C,
        transitionBackdrops: Je,
        hotspotVisible: P,
        onNavigate: Ke,
        onSignClick: (M, A) => {
          (o(M),
            (s.current = A || null),
            A && re("popup_open", { nodeId: E, targetId: A }));
        },
        preservedCameraYaw: i,
        preservedCameraPitch: h,
        onYawChange: (M) => {
          a.current = M;
        },
        onPitchChange: (M) => {
          d.current = M;
        },
        transitionVideoUrl: Xe,
        onTransitionComplete: et,
        onVideoFadeComplete: tt,
        videoTextureYawOffset: Qe,
        spotHasVideo: v,
        videoQueueIndex: G,
        nadirLogoUrl:
          ((je = k == null ? void 0 : k.info) == null
            ? void 0
            : je.nadirLogoUrl) || "",
      }),
      r.jsx(er, {
        nodes: k == null ? void 0 : k.nodes,
        activeNodeId: E,
        onNavigate: Ze,
        audioMuted: ee,
        onToggleAudio: _,
        audioEnabled: rt,
      }),
      y &&
        r.jsx("div", {
          className: "absolute inset-0 z-50 bg-black pointer-events-none",
          style: { opacity: 1, transition: `opacity ${sr}ms ease` },
        }),
      r.jsx("div", {
        className: `absolute bottom-6 left-1/2 -translate-x-1/2 z-10
                      px-4 py-2 rounded-full bg-black/50 backdrop-blur-sm
                      text-white/80 text-sm font-medium border border-white/10
                      pointer-events-none`,
        children: C.displayName,
      }),
      !1,
      r.jsx("button", {
        onClick: O,
        title: j ? "Exit fullscreen" : "Fullscreen",
        className: `absolute bottom-6 right-6 z-10 w-10 h-10 flex items-center
                   justify-center rounded-full bg-black/50 backdrop-blur-sm
                   border border-white/10 text-white/80 hover:text-white
                   hover:bg-black/70 transition-colors cursor-pointer`,
        children: j
          ? r.jsx("svg", {
              width: "16",
              height: "16",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              children: r.jsx("path", {
                d: "M8 3v3a2 2 0 0 1-2 2H3M21 8h-3a2 2 0 0 1-2-2V3M3 16h3a2 2 0 0 1 2 2v3M16 21v-3a2 2 0 0 1 2-2h3",
              }),
            })
          : r.jsx("svg", {
              width: "16",
              height: "16",
              viewBox: "0 0 24 24",
              fill: "none",
              stroke: "currentColor",
              strokeWidth: "2",
              strokeLinecap: "round",
              strokeLinejoin: "round",
              children: r.jsx("path", {
                d: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
              }),
            }),
      }),
      g &&
        r.jsx("div", {
          className: `absolute inset-0 z-20 flex items-center justify-center
                     pointer-events-none`,
          children: r.jsxs("div", {
            className: `flex flex-col items-center gap-3 px-6 py-4 rounded-2xl
                       bg-black/40 backdrop-blur-sm border border-white/10
                       animate-pulse`,
            children: [
              r.jsxs("svg", {
                width: "36",
                height: "36",
                viewBox: "0 0 24 24",
                fill: "none",
                stroke: "white",
                strokeWidth: "1.5",
                strokeLinecap: "round",
                strokeLinejoin: "round",
                opacity: "0.9",
                children: [
                  r.jsx("path", {
                    d: "M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8",
                  }),
                  r.jsx("path", {
                    d: "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15",
                  }),
                ],
              }),
              r.jsx("p", {
                className: "text-white/90 text-sm font-medium",
                children: "Drag to look around · scroll to zoom",
              }),
            ],
          }),
        }),
      N && r.jsx(nr, { tourId: e, nodeId: E, onClose: () => U(!1) }),
      n &&
        r.jsx(tr, {
          content: n,
          onClose: () => {
            (s.current &&
              (re("popup_close", { nodeId: E, targetId: s.current }),
              (s.current = null)),
              o(null));
          },
        }),
    ],
  });
}
nt.createRoot(document.getElementById("root")).render(
  r.jsx(st.StrictMode, {
    children: r.jsx("div", {
      className: "h-dvh w-full overflow-hidden bg-black",
      children: r.jsx(or, { projectId: null }),
    }),
  }),
);
