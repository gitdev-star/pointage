import React, { useMemo, useState } from "react";
import { Clock, TrendingDown, TrendingUp, UserCheck, UserX, HelpCircle, X } from "lucide-react";
import { formatDateTime } from "../utils/FormatDate";

const rowId = (r) => Number(r.user_id ?? r.device_user_id ?? r.userId);
const rowTime = (r) => r.timestamp ?? r.punch_time ?? r.punched_at ?? r.time ?? r.date_time ?? null;
const rowDevice = (r) => r.clocker_name ?? r.device_name ?? r.device_ip ?? r.clocker ?? null;
const fmt = (t) => (t ? formatDateTime(t) || String(t) : "—");

// For each badge id: number of punches today, first/last punch, devices used
function summarize(ids, rows) {
  const map = new Map(ids.map((id) => [id, { id, count: 0, first: null, last: null, devices: new Set() }]));
  for (const r of rows || []) {
    const e = map.get(rowId(r));
    if (!e) continue;
    e.count += 1;
    const t = rowTime(r);
    if (t) {
      if (!e.first || t < e.first) e.first = t;
      if (!e.last || t > e.last) e.last = t;
    }
    const d = rowDevice(r);
    if (d) e.devices.add(d);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.id - b.id);
}

function BadgeListModal({ config, attendanceData, onClose }) {
  const rows = useMemo(() => summarize(config.ids, attendanceData), [config.ids, attendanceData]);
  const [copied, setCopied] = useState(false);

  const copyIds = async () => {
    try {
      await navigator.clipboard.writeText(config.ids.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) { /* clipboard not available */ }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              {config.title} ({config.ids.length})
            </h3>
            <p className="text-sm text-gray-500 mt-1">{config.description}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Badge</th>
                <th className="py-2 pr-3">Pointages</th>
                <th className="py-2 pr-3">Premier</th>
                <th className="py-2 pr-3">Dernier</th>
                <th className="py-2">Appareil(s)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3 font-semibold text-gray-800">{r.id}</td>
                  <td className="py-2 pr-3">{r.count || "—"}</td>
                  <td className="py-2 pr-3">{fmt(r.first)}</td>
                  <td className="py-2 pr-3">{fmt(r.last)}</td>
                  <td className="py-2">{r.devices.size ? [...r.devices].join(", ") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <button onClick={copyIds} className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50">
            {copied ? "Copié" : "Copier les IDs"}
          </button>
          <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

function AbsentListModal({ people, onClose }) {
  const [q, setQ] = useState("");
  const [site, setSite] = useState("");
  const sites = useMemo(
    () => [...new Set(people.map((p) => p.factory).filter(Boolean))].sort(),
    [people]
  );
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return people.filter(
      (p) =>
        (!site || p.factory === site) &&
        (!t || `${p.name} ${p.employee_id} ${p.effectiveBadge ?? ""} ${p.department ?? ""} ${p.section ?? ""}`.toLowerCase().includes(t))
    );
  }, [people, q, site]);

  const exportCsv = () => {
    const esc = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const lines = [["Matricule", "Nom", "Badge", "Site", "Departement", "Section"].map(esc).join(",")];
    list.forEach((p) =>
      lines.push([p.employee_id, p.name, p.effectiveBadge ?? "", p.factory, p.department, p.section].map(esc).join(","))
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sans_pointage_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">Actifs sans pointage ({people.length})</h3>
            <p className="text-sm text-gray-500 mt-1">
              Employés ACTIVE sans aucun pointage aujourd'hui : congés, repos, autre équipe, ou pas encore pointé.
              Ceux sans numéro de badge ne peuvent jamais apparaître comme présents.
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-3 p-4 border-b">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher nom, matricule, badge, département, section"
            className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
          />
          <select value={site} onChange={(e) => setSite(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm">
            <option value="">Tous les sites</option>
            {sites.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>

        <div className="overflow-auto p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="py-2 pr-3">Matricule</th>
                <th className="py-2 pr-3">Nom</th>
                <th className="py-2 pr-3">Badge</th>
                <th className="py-2 pr-3">Site</th>
                <th className="py-2 pr-3">Département</th>
                <th className="py-2">Section</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.employee_id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{p.employee_id}</td>
                  <td className="py-2 pr-3 font-medium text-gray-800">{p.name || "—"}</td>
                  <td className="py-2 pr-3">{p.effectiveBadge ?? "Sans badge"}</td>
                  <td className="py-2 pr-3">{p.factory || "—"}</td>
                  <td className="py-2 pr-3">{p.department || "—"}</td>
                  <td className="py-2">{p.section || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {list.length === 0 && <p className="text-sm text-gray-400 py-6 text-center">Aucun résultat</p>}
        </div>

        <div className="flex items-center justify-between p-4 border-t">
          <span className="text-sm text-gray-500">{list.length} affichés</span>
          <div className="flex gap-2">
            <button onClick={exportCsv} className="text-sm px-3 py-1.5 rounded-lg border hover:bg-gray-50">
              Exporter CSV
            </button>
            <button onClick={onClose} className="text-sm px-3 py-1.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700">
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatsGrid({
  stats, kpi, totalActive: totalActiveProp, absentCount: absentCountProp, classified, attendanceData,
}) {
  const [modal, setModal] = useState(null);
  const [absentOpen, setAbsentOpen] = useState(false);

  const totalActive = classified?.totalActive ?? totalActiveProp;
  const presents = classified ? classified.presentActive : (kpi?.presents ?? 0);
  const late     = classified ? classified.lateActive : (kpi?.late ?? 0);
  const absentCount = classified ? Math.max(0, totalActive - presents) : absentCountProp;

  const tauxPresence = totalActive > 0 ? Math.round((presents / totalActive) * 100) : null;
  const tauxAbsence  = totalActive > 0 ? Math.round((absentCount / totalActive) * 100) : null;
  const tauxRetard   = presents > 0 ? Math.round((late / presents) * 100) : null;

  const kpiCards = [
    { title: "Taux de présence", value: presents, sub: `sur ${totalActive ?? "—"} actifs`,
      percent: tauxPresence, icon: UserCheck, color: "green" },
    { title: "Taux d'absence", value: absentCount, sub: `sur ${totalActive ?? "—"} actifs`,
      percent: tauxAbsence, icon: TrendingDown, color: "red",
      onClick: classified?.absentPeople?.length ? () => setAbsentOpen(true) : null },
    { title: "Taux de retard", value: late, sub: `sur ${presents} présents`,
      percent: tauxRetard, icon: Clock, color: "yellow" },
    { title: "Dernier pointage", value: formatDateTime(stats?.latest_punch) || "—", sub: null,
      percent: null, icon: TrendingUp, color: "blue" },
  ];

  if (classified) {
    kpiCards.push(
      {
        title: "Pointés non actifs", value: classified.inactive,
        sub: "ont pointé, statut inactif dans RH", percent: null, icon: UserX, color: "red",
        onClick: classified.inactiveIds?.length
          ? () => setModal({
              title: "Pointés non actifs",
              description: "Badges dont l'employé n'est pas ACTIVE dans RH (parti, inactif). Vérifiez le statut ou retirez le badge des pointeuses.",
              ids: classified.inactiveIds,
            })
          : null,
      },
      {
        title: "Pointés hors liste RH", value: classified.unknown,
        sub: "badge inconnu dans RH", percent: null, icon: HelpCircle, color: "yellow",
        onClick: classified.unknownIds?.length
          ? () => setModal({
              title: "Pointés hors liste RH",
              description: "Badges qui ont pointé sans fiche RH. Plusieurs pointages sur des appareils d'usine : employé à créer. Un seul pointage : badge de test ou visiteur.",
              ids: classified.unknownIds,
            })
          : null,
      },
    );
    // Data-quality card: only shown when there is something to fix
    if (classified.viaMatricule > 0) {
      kpiCards.push({
        title: "Actifs reconnus par matricule", value: classified.viaMatricule,
        sub: "device_user_id vide dans RH", percent: null, icon: UserCheck, color: "blue",
      });
    }
  }

  const colorMap = {
    green:  { bg: "bg-[#eef3f0]", text: "text-[#4a6656]", bar: "bg-[#6f8f7c]", border: "border-l-[#6f8f7c]" },
    red:    { bg: "bg-[#f7ecea]", text: "text-[#7c433d]", bar: "bg-[#a45c56]", border: "border-l-[#a45c56]" },
    yellow: { bg: "bg-[#f8f2e6]", text: "text-[#8a723f]", bar: "bg-[#b99b5d]", border: "border-l-[#b99b5d]" },
    blue:   { bg: "bg-[#eaeef0]", text: "text-[#3f5462]", bar: "bg-[#5b7a8c]", border: "border-l-[#5b7a8c]" },
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {kpiCards.map((card) => {
          const c = colorMap[card.color];
          const clickable = !!card.onClick;
          return (
            <div
              key={card.title}
              role={clickable ? "button" : undefined}
              tabIndex={clickable ? 0 : undefined}
              onClick={card.onClick || undefined}
              onKeyDown={clickable ? (e) => { if (e.key === "Enter") card.onClick(); } : undefined}
              className={`bg-white rounded-2xl shadow-sm p-5 border border-l-4 ${c.border} ${
                clickable ? "cursor-pointer hover:shadow-md transition-shadow" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-500">{card.title}</p>
                <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
                  <card.icon className={c.text} size={20} />
                </div>
              </div>

              <h2 className={`text-3xl font-bold ${c.text}`}>{card.value}</h2>

              {card.percent != null && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{card.sub}</span>
                    <span className={`font-semibold ${c.text}`}>{card.percent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`${c.bar} h-1.5 rounded-full transition-all duration-500`}
                      style={{ width: `${Math.min(card.percent, 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {card.percent == null && card.sub && (
                <p className="text-xs text-gray-400 mt-2">{card.sub}</p>
              )}

              {clickable && (
                <p className={`text-xs font-medium mt-2 ${c.text}`}>Voir la liste →</p>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <BadgeListModal config={modal} attendanceData={attendanceData} onClose={() => setModal(null)} />
      )}
      {absentOpen && classified?.absentPeople && (
        <AbsentListModal people={classified.absentPeople} onClose={() => setAbsentOpen(false)} />
      )}
    </>
  );
}
