/*
 * In-memory stand-in for the Lager runtime (window.lager), used by the test suite.
 *
 * It implements the parts of the runtime the apps use: db (documents, queries, live snapshots),
 * user, ingest, embed, assets, downloads, permissions, complete and a no-op room.
 * Configure it before the page loads by setting window.__LAGER_CONFIG__:
 *   { seed: [{path, data}], user: {id, name, owner, canEdit}, capabilities: {...}, completeReply: "..." }
 * Tests read and drive it through window.__lager:
 *   __lager.store       path -> data
 *   __lager.writes      every write [{op, path, data}]
 *   __lager.downloads   files offered through downloads.save
 *   __lager.ingest(collection, body)  add a document as if it arrived at an ingest endpoint
 *   __lager.flush()     resolves once pending snapshot listeners have run
 */
(() => {
  "use strict";
  const cfg = window.__LAGER_CONFIG__ || {};
  const declared = cfg.capabilities || null;            // null: everything available
  const store = new Map();
  const writes = [], downloads = [], assets = new Map();
  (cfg.seed || []).forEach(d => store.set(d.path, clone(d.data)));
  const subs = new Set();
  let pending = null;

  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function freeze(o) { if (o && typeof o === "object") { Object.values(o).forEach(freeze); Object.freeze(o); } return o; }
  function err(code, message) { const e = new Error(message || code); e.code = code; return e; }
  function segs(path) {
    if (typeof path !== "string" || !path || path.startsWith("/") || path.endsWith("/")) throw new TypeError("Invalid path: " + path);
    const s = path.split("/");
    if (s.some(x => !x || x === "." || x === ".." || !/^[A-Za-z0-9_\-.~:@+]+$/.test(x))) throw new TypeError("Invalid path: " + path);
    return s;
  }
  function checkData(data) {
    const json = JSON.stringify(data);
    if (json === undefined || typeof data !== "object" || data === null || Array.isArray(data)) throw err("invalid_argument", "Documents are JSON objects");
    if (json.length > 256 * 1024) throw err("invalid_argument", "Document larger than 256 KiB");
    (function walk(v) { if (typeof v === "number" && !isFinite(v)) throw err("invalid_argument", "Numbers must be finite"); if (v && typeof v === "object") Object.values(v).forEach(walk); })(data);
  }
  function notify() {
    if (pending) return pending;
    pending = new Promise(r => setTimeout(() => { pending = null; subs.forEach(f => { try { f(); } catch (e) { setTimeout(() => { throw e; }); } }); r(); }, 0));
    return pending;
  }
  const get = (o, p) => p.split(".").reduce((a, k) => a == null ? a : a[k], o);
  function merge(a, b) {
    Object.keys(b).forEach(k => {
      const v = b[k];
      if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object" && !Array.isArray(a[k])) merge(a[k], v);
      else a[k] = clone(v);
    });
    return a;
  }
  const dsnap = path => ({ id: path.split("/").pop(), exists: store.has(path), data: () => store.has(path) ? freeze(clone(store.get(path))) : undefined });

  function docRef(path) {
    if (segs(path).length % 2) throw new TypeError("Document paths have an even number of segments: " + path);
    return {
      id: path.split("/").pop(), path,
      async get() { return dsnap(path); },
      async set(data) { checkData(data); store.set(path, clone(data)); writes.push({ op: "set", path, data: clone(data) }); notify(); },
      async update(data) { checkData(data); store.set(path, merge(clone(store.get(path)) || {}, data)); writes.push({ op: "update", path, data: clone(data) }); notify(); },
      async delete() { store.delete(path); writes.push({ op: "delete", path }); notify(); },
      collection: name => collRef(path + "/" + name),
      onSnapshot(next, error) { const f = () => next(dsnap(path)); subs.add(f); setTimeout(f, 0); return () => subs.delete(f); },
      async acquire({ ttlMs = 30000 } = {}) { return { acquired: true, version: 1, expiresAt: Date.now() + ttlMs }; }
    };
  }
  const OPS = {
    "==": (x, v) => x === v, "!=": (x, v) => x !== v, "<": (x, v) => x < v, "<=": (x, v) => x <= v, ">": (x, v) => x > v, ">=": (x, v) => x >= v,
    "in": (x, v) => v.includes(x), "not-in": (x, v) => !v.includes(x),
    "array-contains": (x, v) => Array.isArray(x) && x.includes(v), "array-contains-any": (x, v) => Array.isArray(x) && x.some(y => v.includes(y))
  };
  function query(path, wh, ob, lim) {
    const depth = segs(path).length;
    if (depth % 2 === 0) throw new TypeError("Collection paths have an odd number of segments: " + path);
    const run = () => {
      let rows = [...store.keys()].filter(p => p.startsWith(path + "/") && p.split("/").length === depth + 1).map(p => ({ p, d: store.get(p) }));
      wh.forEach(([f, op, v]) => { rows = rows.filter(r => OPS[op](get(r.d, f), v)); });
      if (ob.length) rows.sort((a, b) => { for (const [f, dir] of ob) { const x = get(a.d, f), y = get(b.d, f); if (x !== y) return (x < y ? -1 : 1) * (dir === "desc" ? -1 : 1); } return 0; });
      else rows.sort((a, b) => a.p < b.p ? -1 : 1);
      rows = rows.slice(0, Math.min(lim || 1000, 1000));
      const docs = rows.map(r => dsnap(r.p));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => docs.map((doc, i) => ({ type: "added", doc, oldIndex: -1, newIndex: i })) };
    };
    return {
      path,
      where(f, op, v) { if (!OPS[op]) throw new TypeError("Unknown operator " + op); return query(path, wh.concat([[f, op, v]]), ob, lim); },
      orderBy(f, dir) { return query(path, wh, ob.concat([[f, dir || "asc"]]), lim); },
      limit(n) { return query(path, wh, ob, n); },
      async get() { return run(); },
      onSnapshot(next, error) {
        let last = null;
        const f = () => { const s = run(); const sig = JSON.stringify(s.docs.map(d => [d.id, d.data()])); if (sig === last) return; last = sig; next(s); };
        subs.add(f); setTimeout(f, 0); return () => subs.delete(f);
      }
    };
  }
  function collRef(path) {
    const q = query(path, [], [], 0);
    return Object.assign(q, {
      doc: id => docRef(path + "/" + (id || Math.random().toString(36).slice(2, 14))),
      async add(data) { const r = docRef(path + "/" + Math.random().toString(36).slice(2, 14)); await r.set(data); return r; }
    });
  }

  const u = Object.assign({ id: "test-user", name: "Test User", owner: true, canEdit: true }, cfg.user || {});
  const signedIn = !!u.id;
  const NS = {
    db: { collection: collRef, doc: docRef },
    user: {
      id: async () => signedIn ? u.id : null, name: async () => signedIn ? u.name : null, email: async () => null,
      isOwner: async () => !!u.owner, canEdit: async () => !!u.canEdit, can: async () => !!u.canEdit,
      me: async () => signedIn ? { id: u.id, name: u.name } : null,
      profiles: async ids => ids.map(id => id === u.id ? { id, name: u.name } : null), search: async () => [], avatarUrl: async () => null
    },
    downloads: { async save({ filename, data }) { downloads.push({ filename, data: typeof data === "string" ? data : "[binary]" }); return { saved: true }; } },
    assets: {
      async upload(blob, opts) { const id = Math.random().toString(36).slice(2, 10); assets.set(id, { id, url: "/_blob/" + id, type: (opts && opts.type) || blob.type || "" }); return assets.get(id); },
      async list() { return [...assets.values()]; }, async delete(x) { assets.delete(String(x).split("/").pop()); }
    },
    ingest: {
      async endpoints() {
        const eps = ((declared && declared.ingest && declared.ingest.endpoints) || []);
        return eps.map(e => ({ name: e.name, url: location.origin + "/_ingest/" + e.name, auth: e.auth, collection: e.collection || e.name, origins: e.origins || [], managedOrigins: !!e.managedOrigins, instanceOrigins: [], maxBytes: e.maxBytes || 4096, enabled: true, token: u.owner && e.auth === "token" ? "test-token" : null, canManage: !!u.owner }));
      },
      async setOrigins(name, origins) { return { name, instanceOrigins: origins }; }
    },
    embed: { async get() { return { origins: [], active: [], limit: 20, canManage: !!u.owner, manageUrl: location.origin + "/__lager/instance" }; }, async setOrigins(o) { return { origins: o, active: o, limit: 20, canManage: true }; } },
    permissions: { async state() { return {}; }, async request() { return {}; }, async manage() {} },
    room: { join() { return { emit() {}, on() {}, presence() {}, peers: () => [], onPeers() {}, connected: true, onConnection() {}, leave() {} }; } },
    page: null
  };
  const always = new Set(["db", "user", "permissions"]);
  window.lager = {
    async use(name) {
      if (!(name in NS)) return null;
      if (declared && !always.has(name) && !(name in declared)) return null;
      return NS[name];
    },
    async complete(prompt, options) {
      if (declared && !("complete" in declared)) throw err("not_declared");
      if (cfg.completeReply == null) throw err("not_configured", "No model in tests");
      return options && options.full ? { text: cfg.completeReply, model: "test", stopReason: "end", truncated: false } : cfg.completeReply;
    }
  };
  window.__lager = {
    store, writes, downloads,
    ingest(collection, body) { const id = Math.random().toString(36).slice(2, 14); store.set(collection + "/" + id, Object.assign(clone(body), { _receivedAt: new Date().toISOString() })); return notify(); },
    set(path, data) { store.set(path, clone(data)); return notify(); },
    flush: () => notify(),
    dump: () => Object.fromEntries(store)
  };
})();
