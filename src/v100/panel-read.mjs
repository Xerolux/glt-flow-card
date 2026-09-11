/* Deduplicate in-flight panel reads only. Never retry or cache control calls. */
const pending = new WeakMap();

export function readPanel(owner, type, payload, { timeoutMs = 12000 } = {}) {
  const transport = owner?._hass?.callWS;
  if (!transport) return Promise.reject(new Error("Companion unavailable"));
  let requests = pending.get(owner);
  if (!requests) pending.set(owner, requests = new Map());
  const key = JSON.stringify([type, payload]);
  const existing = requests.get(key);
  if (existing?.transport === transport) return existing.promise;
  let timer;
  const record = { transport };
  record.promise = Promise.race([
    Promise.resolve().then(() => transport.call(owner._hass, { type, ...payload })),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Companion request timed out")), timeoutMs);
    }),
  ]).finally(() => {
    clearTimeout(timer);
    if (requests.get(key) === record) requests.delete(key);
  });
  requests.set(key, record);
  return record.promise;
}
