// Phase 5 — Local progress tracker. Entries live only in this phone's
// browser storage (IndexedDB). Nothing is sent to a server. The user can
// export a CSV (Table D columns) or delete everything at any time.

const DB = "acnelens", STORE = "journal", VERSION = 1;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    let result;
    Promise.resolve(fn(store)).then((r) => { result = r; });
    t.oncomplete = () => { db.close(); resolve(result); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

const req2p = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const addEntry = (entry) => tx("readwrite", (s) => req2p(s.add(entry)));
export const allEntries = () => tx("readonly", (s) => req2p(s.getAll())).then((x) => x.sort((a, b) => b.date.localeCompare(a.date)));
export const deleteEntry = (id) => tx("readwrite", (s) => req2p(s.delete(id)));
export const clearAll = () => tx("readwrite", (s) => req2p(s.clear()));

const COLUMNS = [
  ["Session_ID", (e) => e.id],
  ["Date_Logged", (e) => e.date.slice(0, 10)],
  ["AI_Result", (e) => e.aiResult],
  ["AI_Confidence_Score", (e) => Math.round(e.confidence * 100) + "%"],
  ["Skin_State", (e) => e.skinType],
  ["Sensitivity_Level", (e) => e.sensitivity],
  ["Active_Usage", (e) => e.activeUsage],
  ["Self_Reported_Lesion", (e) => e.lesion],
  ["Routine_Followed", (e) => e.routineFollowed],
  ["Irritation_Score", (e) => e.irritation],
  ["Rules_Applied", (e) => e.rules.join(" ")],
  ["Cleanser", (e) => e.cleanser],
  ["Target", (e) => e.target],
  ["Moisturizer", (e) => e.moisturizer],
];

export function toCSV(entries) {
  const esc = (v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const rows = [COLUMNS.map((c) => c[0]).join(",")];
  for (const e of [...entries].sort((a, b) => a.date.localeCompare(b.date))) rows.push(COLUMNS.map(([, f]) => esc(f(e))).join(","));
  return rows.join("\n") + "\n";
}
