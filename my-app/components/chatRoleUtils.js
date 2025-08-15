export function getCachedAdminSenderIds() {
  try {
    const raw = localStorage.getItem("adminSenderIds:v1");
    if (!raw) return new Set();
    const { ids, ts } = JSON.parse(raw);
    // TTL 1 heure
    if (!ts || Date.now() - ts > 3600_000) return new Set(ids || []);
    return new Set(ids || []);
  } catch {
    return new Set();
  }
}

export function cacheAdminSenderIds(idsSet) {
  try {
    const ids = Array.from(idsSet || []);
    localStorage.setItem("adminSenderIds:v1", JSON.stringify({ ids, ts: Date.now() }));
  } catch {}
}

export async function discoverAdminSenderIds(backendBaseUrl = "https://backend-eaukey.duckdns.org") {
  // Récupère la liste des clients puis agrège les sender_id qui parlent à plusieurs clients
  const adminIds = new Set();
  try {
    const resClients = await fetch(`${backendBaseUrl}/clients?is_admin=true`);
    if (!resClients.ok) return adminIds;
    const clients = await resClients.json();
    if (!Array.isArray(clients) || clients.length === 0) return adminIds;

    // Limite douce pour éviter trop d'appels (peut être ajustée)
    const sample = clients.slice(0, 50);
    const senderIdToClientIds = new Map();

    await Promise.all(
      sample.map(async (c) => {
        try {
          const res = await fetch(`${backendBaseUrl}/messages/${encodeURIComponent(c.client_id)}`);
          if (!res.ok) return;
          const msgs = await res.json();
          if (!Array.isArray(msgs)) return;
          msgs.forEach((m) => {
            const sid = m?.sender_id;
            if (sid == null) return;
            if (!senderIdToClientIds.has(sid)) senderIdToClientIds.set(sid, new Set());
            senderIdToClientIds.get(sid).add(c.client_id);
          });
        } catch {}
      })
    );

    // Heuristique: un admin envoie à 2+ clients distincts et n'est pas déjà 0/1
    for (const [sid, cidSet] of senderIdToClientIds.entries()) {
      if (sid !== 0 && sid !== 1 && cidSet.size >= 2) {
        adminIds.add(sid);
      }
    }

    // Mémorise en cache
    cacheAdminSenderIds(adminIds);
  } catch {}

  return adminIds;
} 