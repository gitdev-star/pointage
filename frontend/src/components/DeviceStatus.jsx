import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff, ChevronDown, ChevronUp } from "lucide-react";

const POLL_INTERVAL_MS = 15000;

function CapacityBar({ label, used, cap }) {
  if (used == null || cap == null || cap === 0) return null;
  const pct = Math.min(100, Math.round((used / cap) * 100));
  const isHigh = pct >= 90;
  const isMid = pct >= 70;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-steel w-16 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-steel/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isHigh ? "bg-red-500" : isMid ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-steel tabular-nums w-14 text-right shrink-0">
        {used}/{cap}
      </span>
    </div>
  );
}

function DeviceCard({ device }) {
  const [expanded, setExpanded] = useState(false);
  const hasInfo = device.reachable && device.serial_number != null;

  return (
    <div className="border border-steel/20 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <p className="font-medium text-ink truncate">{device.name}</p>
          <p className="text-xs text-steel">{device.ip_address}:{device.port}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-block w-3 h-3 rounded-full ${
              device.reachable ? "bg-green-500" : "bg-red-500"
            }`}
            title={device.reachable ? "Reachable" : "Unreachable"}
          />
          {device.reachable ? (
            <Wifi size={16} className="text-green-600" />
          ) : (
            <WifiOff size={16} className="text-red-500" />
          )}
        </div>
      </div>

      {hasInfo && (
        <>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-3 flex items-center gap-1 text-xs text-steel hover:text-ink transition-colors"
          >
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {expanded ? "Masquer les détails" : "Voir les détails"}
          </button>

          {expanded && (
            <div className="mt-3 pt-3 border-t border-steel/10 space-y-2">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-steel">
                <div>
                  <span className="text-ink/60">N° série</span>
                  <p className="text-ink font-mono truncate">{device.serial_number ?? "—"}</p>
                </div>
                <div>
                  <span className="text-ink/60">Firmware</span>
                  <p className="text-ink font-mono truncate">{device.firmware_version ?? "—"}</p>
                </div>
                <div>
                  <span className="text-ink/60">Plateforme</span>
                  <p className="text-ink truncate">{device.platform ?? "—"}</p>
                </div>
                <div>
                  <span className="text-ink/60">MAC</span>
                  <p className="text-ink font-mono truncate">{device.mac_address ?? "—"}</p>
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <CapacityBar label="Employés" used={device.user_count} cap={device.user_capacity} />
                <CapacityBar label="Empreintes" used={device.fingerprint_count} cap={device.fingerprint_capacity} />
                <CapacityBar label="Pointages" used={device.record_count} cap={device.record_capacity} />
                {device.face_capacity > 0 && (
                  <CapacityBar label="Visages" used={device.face_count} cap={device.face_capacity} />
                )}
              </div>
            </div>
          )}
        </>
      )}

      {device.reachable && !hasInfo && (
        <p className="mt-3 text-[11px] text-steel/70 italic">Détails indisponibles</p>
      )}
    </div>
  );
}

export default function DeviceStatus() {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/fastapi/devices/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDevices(data.devices || []);
      setLastChecked(data.checked_at);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const reachableCount = devices.filter((d) => d.reachable).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-ink">Appareils de pointage</h1>
          <p className="text-sm text-steel">
            {reachableCount}/{devices.length} en ligne
            {lastChecked && ` · dernière vérification ${new Date(lastChecked).toLocaleTimeString()}`}
          </p>
        </div>
        <button
          onClick={() => { setLoading(true); fetchStatus(); }}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-steel/30 rounded-md hover:bg-steel/10 transition-colors"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Rafraîchir
        </button>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
          Impossible de récupérer le statut des appareils : {error}
        </div>
      )}

      {loading && devices.length === 0 ? (
        <p className="text-steel text-sm">Chargement...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {devices.map((device) => (
            <DeviceCard key={device.id ?? device.ip_address} device={device} />
          ))}
        </div>
      )}

      {!loading && devices.length === 0 && !error && (
        <p className="text-steel text-sm">Aucun appareil trouvé.</p>
      )}
    </div>
  );
}