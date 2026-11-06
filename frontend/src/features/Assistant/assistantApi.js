const BASE = process.env.REACT_APP_FASTAPI_URL || `${window.location.origin}/api/fastapi`;

async function call(path, { method = "GET", body, signal } = {}) {
  const token = localStorage.getItem("access_token");
  const res = await fetch(`${BASE}${path}`, {
    method,
    signal,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (_) { /* no JSON body */ }
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { response: { status: res.status, data } });
  }
  return data;
}

export const askAssistant = (question, conversationId, signal) =>
  call("/api/ai/chat", { method: "POST", body: { question, conversation_id: conversationId }, signal });
export const listConversations = () => call("/api/ai/conversations");
export const getConversation = (id) => call(`/api/ai/conversations/${id}`);
export const deleteConversation = (id) => call(`/api/ai/conversations/${id}`, { method: "DELETE" });
