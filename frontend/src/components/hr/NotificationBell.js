import React, { useEffect, useState, useRef, useCallback } from "react";
import hrClient from "../../api/hrClient";

const LEVEL_COLORS = {
  info:    { bg: "#e3f2fd", border: "#1565c0", dot: "#1565c0" },
  warning: { bg: "#fff8e1", border: "#f57f17", dot: "#f9a825" },
  error:   { bg: "#ffebee", border: "#c62828", dot: "#e53935" },
  success: { bg: "#e8f5e9", border: "#2e7d32", dot: "#43a047" },
};

const CATEGORY_ICONS = {
  cdd:      "⚠️",
  leave:    "🏖️",
  maternity:"🤰",
  employee: "👤",
  system:   "🔔",
};

export default function NotificationBell() {
  const [count,         setCount]   = useState(0);
  const [notifications, setNotifs]  = useState([]);
  const [open,          setOpen]    = useState(false);
  const [loading,       setLoading] = useState(false);
  const ref = useRef(null);

  const fetchCount = useCallback(async () => {
    try {
      const res = await hrClient.get("alerts/inbox/unread_count/");
      setCount(res.data.count || 0);
    } catch {}
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get("alerts/inbox/?page_size=20");
      setNotifs(res.data.results || res.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  // Poll unread count every 30 seconds
  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleOpen = () => {
    if (!open) fetchNotifications();
    setOpen(o => !o);
  };

  const markAllRead = async () => {
    try {
      await hrClient.post("alerts/inbox/mark_all_read/");
      setCount(0);
      setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch {}
  };

  const markOneRead = async (id) => {
    try {
      await hrClient.patch(`alerts/inbox/${id}/`, { is_read: true });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      setCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const timeAgo = (dateStr) => {
    const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
    if (diff < 60)   return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400)return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}j`;
  };

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      {/* Bell button */}
      <button onClick={handleOpen} style={{
        position: "relative", background: "none", border: "none",
        cursor: "pointer", padding: "6px 8px", borderRadius: "8px",
        fontSize: "20px", lineHeight: 1,
        backgroundColor: open ? "rgba(255,255,255,0.15)" : "transparent",
        transition: "background 0.2s",
      }}>
        🔔
        {count > 0 && (
          <span style={{
            position: "absolute", top: "2px", right: "2px",
            background: "#e53935", color: "#fff",
            borderRadius: "50%", fontSize: "10px", fontWeight: 700,
            minWidth: "16px", height: "16px",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 3px", lineHeight: 1,
          }}>
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 8px)",
          width: "360px", maxHeight: "480px",
          background: "#fff", borderRadius: "12px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
          zIndex: 9999, display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderBottom: "1px solid #eee",
            background: "#1565c0",
          }}>
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "14px" }}>
              🔔 Notifications {count > 0 && `(${count} non lues)`}
            </span>
            {count > 0 && (
              <button onClick={markAllRead} style={{
                background: "rgba(255,255,255,0.2)", border: "none",
                color: "#fff", borderRadius: "6px", padding: "3px 8px",
                fontSize: "11px", cursor: "pointer",
              }}>
                Tout marquer lu
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: "auto", flex: 1 }}>
            {loading ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#888" }}>
                Chargement...
              </div>
            ) : notifications.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px", color: "#aaa" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px" }}>🔕</div>
                <div>Aucune notification</div>
              </div>
            ) : notifications.map(n => {
              const colors = LEVEL_COLORS[n.level] || LEVEL_COLORS.info;
              return (
                <div key={n.id} onClick={() => !n.is_read && markOneRead(n.id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid #f0f0f0",
                    background: n.is_read ? "#fff" : colors.bg,
                    borderLeft: n.is_read ? "3px solid transparent" : `3px solid ${colors.border}`,
                    cursor: n.is_read ? "default" : "pointer",
                    transition: "background 0.2s",
                  }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div style={{ display: "flex", gap: "8px", flex: 1 }}>
                      <span style={{ fontSize: "16px", flexShrink: 0 }}>
                        {CATEGORY_ICONS[n.category] || "🔔"}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{
                          fontWeight: n.is_read ? 500 : 700,
                          fontSize: "13px", color: "#1a1a1a", marginBottom: "2px",
                        }}>
                          {n.title}
                        </div>
                        <div style={{ fontSize: "12px", color: "#666", lineHeight: 1.4 }}>
                          {n.message}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", marginLeft: "8px" }}>
                      <span style={{ fontSize: "11px", color: "#aaa", whiteSpace: "nowrap" }}>
                        {timeAgo(n.created_at)}
                      </span>
                      {!n.is_read && (
                        <span style={{
                          width: "8px", height: "8px", borderRadius: "50%",
                          background: colors.dot, display: "inline-block",
                        }} />
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
