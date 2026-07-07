import React, { useEffect, useState, useCallback } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

const POLL_INTERVAL_MS = 15000;

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
            <div
              key={device.id ?? device.ip_address}
              className="border border-steel/20 rounded-lg p-4 flex items-center justify-between shadow-sm"
            >
              <div>
                <p className="font-medium text-ink">{device.name}</p>
                <p className="text-xs text-steel">{device.ip_address}:{device.port}</p>
              </div>
              <div className="flex items-center gap-2">
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
          ))}
        </div>
      )}

      {!loading && devices.length === 0 && !error && (
        <p className="text-steel text-sm">Aucun appareil trouvé.</p>
      )}
    </div>
  );
}