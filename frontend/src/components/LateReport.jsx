// =====================================================
// PATH: pointage/frontend/src/components/LateReport.jsx
// =====================================================
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AlertTriangle, Download, Search, ChevronDown, ChevronUp,
  Clock, Users, BarChart2, Calendar, TrendingUp, Loader, Tag
} from 'lucide-react';
import './LateReport.css';

const API_BASE = (process.env.REACT_APP_API_URL || '') + '/attendance';

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  '', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const now = new Date();

// Special sentinel values for the classification dropdown
const CLASS_DEFAULT = '__DEFAULT__';   // = exclude HC (non-managers only)
const CLASS_ALL     = 'ALL';           // = include everyone

// ── Small components ──────────────────────────────────────────────────────────

const StatPill = ({ icon: Icon, label, value, color }) => (
  <div className={`lr-stat-pill lr-stat-pill--${color}`}>
    <div className="lr-stat-pill__icon"><Icon size={18} /></div>
    <div>
      <div className="lr-stat-pill__value">{value}</div>
      <div className="lr-stat-pill__label">{label}</div>
    </div>
  </div>
);

const LateBadge = ({ count }) => {
  const level = count >= 10 ? 'critical' : count >= 6 ? 'high' : count >= 3 ? 'medium' : 'low';
  return <span className={`lr-badge lr-badge--${level}`}>{count}×</span>;
};

const RateBar = ({ pct }) => (
  <div className="lr-rate-bar">
    <div
      className={`lr-rate-bar__fill ${pct >= 50 ? 'lr-rate-bar__fill--critical' : pct >= 25 ? 'lr-rate-bar__fill--high' : 'lr-rate-bar__fill--low'}`}
      style={{ width: `${Math.min(100, pct)}%` }}
    />
    <span className="lr-rate-bar__label">{pct}%</span>
  </div>
);

// ── Employee row (expandable) ─────────────────────────────────────────────────

const EmployeeRow = ({ emp, rank, employeeName }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        className={`lr-tr lr-tr--main ${expanded ? 'lr-tr--expanded' : ''}`}
        onClick={() => setExpanded(v => !v)}
      >
        <td className="lr-td lr-td--rank">
          <span className={`lr-rank ${rank <= 3 ? 'lr-rank--top' : ''}`}>#{rank}</span>
        </td>
        <td className="lr-td lr-td--employee">
          <div className="lr-employee-cell">
            <div className="lr-avatar">
              {employeeName ? employeeName.charAt(0).toUpperCase() : '?'}
            </div>
            <div>
              <div className="lr-employee-name">
                {employeeName || `Employé #${emp.user_id}`}
              </div>
              <div className="lr-employee-id">ID: {emp.user_id}</div>
            </div>
          </div>
        </td>
        <td className="lr-td lr-td--center">
          <LateBadge count={emp.late_count} />
        </td>
        <td className="lr-td lr-td--center">{emp.total_days_present}j</td>
        <td className="lr-td lr-td--rate">
          <RateBar pct={emp.late_rate_pct} />
        </td>
        <td className="lr-td lr-td--expand">
          {expanded
            ? <ChevronUp size={16} className="lr-chevron" />
            : <ChevronDown size={16} className="lr-chevron" />
          }
        </td>
      </tr>

      {expanded && (
        <tr className="lr-tr lr-tr--detail">
          <td colSpan={6} className="lr-td lr-td--detail">
            <div className="lr-detail-grid">
              {emp.late_days.map((ld, i) => (
                <div key={i} className="lr-detail-card">
                  <div className="lr-detail-card__date">
                    {new Date(ld.date + 'T00:00:00').toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short'
                    })}
                  </div>
                  <div className="lr-detail-card__day">{ld.day_name}</div>
                  <div className="lr-detail-card__time">
                    <Clock size={11} /> {ld.arrival || '—'}
                  </div>
                  <div className={`lr-detail-card__delta ${ld.minutes_late >= 30 ? 'lr-detail-card__delta--bad' : ''}`}>
                    +{ld.minutes_late} min
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const LateReport = () => {
  const [year, setYear]       = useState(now.getFullYear());
  const [month, setMonth]     = useState(now.getMonth() + 1);
  const [minLate, setMinLate] = useState(3);
  const [sortBy, setSortBy]   = useState('late_count');
  const [sortDir, setSortDir] = useState('desc');
  const [search, setSearch]   = useState('');

  // Classification state
  // CLASS_DEFAULT = exclude HC (non-managers), CLASS_ALL = everyone, "HC" = managers only
  const [classification, setClassification]   = useState(CLASS_DEFAULT);
  const [classifications, setClassifications] = useState([]);
  const [classLoading, setClassLoading]       = useState(false);

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);
  const [exporting, setExporting] = useState(false);

  // Employee name cache
  const [employeeMap, setEmployeeMap] = useState(() => {
    try {
      const cached = sessionStorage.getItem('empMap_v1');
      return cached ? JSON.parse(cached) : {};
    } catch { return {}; }
  });

  const getEmployeeName = useCallback(
    (uid) => employeeMap[Number(uid)]?.name || null,
    [employeeMap]
  );

  // Fetch employee map on mount if empty
  useEffect(() => {
    sessionStorage.removeItem("empMap_v1");
    import('../api/hrClient').then(({ default: hrClient }) => {
      hrClient.get('employees/', { params: { page_size: 5000, status: 'ACTIVE' } })
        .then(res => {
          const employees = res.data.results ?? res.data;
          const map = {};
          employees.forEach(e => {
            const numId = parseInt(e.employee_id, 10);
            if (!isNaN(numId)) {
              map[numId] = { name: `${e.first_name} ${e.last_name}`.trim() || e.employee_id };
            }
          });
          try { sessionStorage.setItem('empMap_v1', JSON.stringify(map)); } catch (_) {}
          setEmployeeMap(map);
        })
        .catch(() => {});
    });
  }, []);

  // ── Fetch available classifications on mount ───────────────────────────────

  useEffect(() => {
    const fetchClassifications = async () => {
      setClassLoading(true);
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/classifications`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (res.ok) {
          const json = await res.json();
          setClassifications(json.classifications || []);
        }
      } catch {
        // silently fail — dropdown will just show the static options
      } finally {
        setClassLoading(false);
      }
    };
    fetchClassifications();
  }, []);

  // ── Build the classification param to send to the API ─────────────────────
  // CLASS_DEFAULT → send nothing (backend defaults to excluding HC)
  // CLASS_ALL     → send "ALL"
  // anything else → send the value directly (e.g. "HC")

  const classificationParam = classification === CLASS_DEFAULT
    ? null
    : classification;

  // ── Fetch report ──────────────────────────────────────────────────────────

  const handleSearch = async () => {
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE}/late-report?year=${year}&month=${month}&min_late=${minLate}`;
      if (classificationParam) url += `&classification=${encodeURIComponent(classificationParam)}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Erreur ${res.status}`);
      }
      setData(await res.json());
    } catch (e) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const handleExport = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE}/late-report/export?year=${year}&month=${month}&min_late=${minLate}`;
      if (classificationParam) url += `&classification=${encodeURIComponent(classificationParam)}`;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(`Erreur ${res.status}`);
      const blob = await res.blob();
      const a    = document.createElement('a');
      a.href     = URL.createObjectURL(blob);
      a.download = `retards_${year}_${String(month).padStart(2, '0')}_min${minLate}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) {
      alert(e.message || "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  // ── Sort + filter (client-side) ───────────────────────────────────────────

  const sortedEmployees = useMemo(() => {
    if (!data?.employees) return [];
    let list = [...data.employees];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(emp => {
        const name = getEmployeeName(emp.user_id)?.toLowerCase() || '';
        return name.includes(q) || String(emp.user_id).includes(q);
      });
    }

    list.sort((a, b) => {
      const va = a[sortBy] ?? 0;
      const vb = b[sortBy] ?? 0;
      return sortDir === 'desc' ? vb - va : va - vb;
    });

    return list;
  }, [data, sortBy, sortDir, search, getEmployeeName]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="lr-sort-icon lr-sort-icon--inactive">↕</span>;
    return <span className="lr-sort-icon">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  // ── Classification label helper ───────────────────────────────────────────

  const classLabel = (val) => {
    if (val === CLASS_DEFAULT) return 'NON-HC (défaut)';
    if (val === CLASS_ALL)     return 'Tous les employés';
    return val;
  };

  // ── Years dropdown ────────────────────────────────────────────────────────

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="lr-page">

      {/* ── Header ── */}
      <div className="lr-header">
        <div className="lr-header__left">
          <div className="lr-header__icon"><AlertTriangle size={22} /></div>
          <div>
            <h1 className="lr-header__title">Rapport de retards</h1>
            <p className="lr-header__sub">
              Employés en retard ≥ N fois sur un mois donné
            </p>
          </div>
        </div>
        {data && (
          <button
            className="lr-btn lr-btn--export"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting
              ? <><Loader size={14} className="lr-spin" /> Export…</>
              : <><Download size={14} /> Exporter CSV</>
            }
          </button>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="lr-controls">
        <div className="lr-control-group">
          <label className="lr-label">Mois</label>
          <select
            className="lr-select"
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.slice(1).map((name, i) => (
              <option key={i + 1} value={i + 1}>{name}</option>
            ))}
          </select>
        </div>

        <div className="lr-control-group">
          <label className="lr-label">Année</label>
          <select
            className="lr-select"
            value={year}
            onChange={e => setYear(Number(e.target.value))}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="lr-control-group">
          <label className="lr-label">Seuil minimum</label>
          <div className="lr-threshold-input">
            <input
              type="number"
              className="lr-input lr-input--narrow"
              min={1}
              max={31}
              value={minLate}
              onChange={e => setMinLate(Math.max(1, Number(e.target.value)))}
            />
            <span className="lr-threshold-unit">retard(s)</span>
          </div>
        </div>

        {/* ── Classification dropdown ── */}
        <div className="lr-control-group">
          <label className="lr-label">
            <Tag size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Classification
          </label>
          <select
            className="lr-select lr-select--classification"
            value={classification}
            onChange={e => { setClassification(e.target.value); setData(null); }}
            disabled={classLoading}
          >
            {/* Default: exclude HC */}
            <option value={CLASS_DEFAULT}>Tout les Ouvriers (défaut)</option>

            {/* All employees */}
            <option value={CLASS_ALL}>Tous les employés</option>

            {/* Separator if we have dynamic classifications */}
            {classifications.length > 0 && (
              <option disabled>──────────────</option>
            )}

            {/* Dynamic classifications from the API */}
            {classifications.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Contextual hint badge */}
          {classification === CLASS_DEFAULT && (
            <span className="lr-class-hint lr-class-hint--info">
              Cadres exclus
            </span>
          )}
          {classification === CLASS_ALL && (
            <span className="lr-class-hint lr-class-hint--neutral">
              Cadres inclus
            </span>
          )}
          {classification !== CLASS_DEFAULT && classification !== CLASS_ALL && (
            <span className="lr-class-hint lr-class-hint--active">
              {classification} uniquement
            </span>
          )}
        </div>

        <button
          className="lr-btn lr-btn--search"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading
            ? <><Loader size={14} className="lr-spin" /> Analyse…</>
            : <><Search size={14} /> Analyser</>
          }
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="lr-error">
          <AlertTriangle size={15} />
          {error}
        </div>
      )}

      {/* ── Stats bar ── */}
      {data && (
        <div className="lr-stats-bar">
          <StatPill
            icon={Users}
            label="Employés analysés"
            value={data.total_employees_analyzed}
            color="blue"
          />
          <StatPill
            icon={AlertTriangle}
            label={`En retard ≥ ${data.min_late}×`}
            value={data.total_late_employees}
            color="orange"
          />
          <StatPill
            icon={BarChart2}
            label="Taux (en retard / analysés)"
            value={
              data.total_employees_analyzed
                ? `${Math.round(data.total_late_employees / data.total_employees_analyzed * 100)}%`
                : '—'
            }
            color="red"
          />
          <StatPill
            icon={Calendar}
            label="Période"
            value={`${MONTH_NAMES[data.month]} ${data.year}`}
            color="teal"
          />
          <StatPill
            icon={Tag}
            label="Périmètre"
            value={classLabel(classification)}
            color="purple"
          />
        </div>
      )}

      {/* ── Search within results ── */}
      {data && data.employees.length > 0 && (
        <div className="lr-search-bar">
          <Search size={15} className="lr-search-icon" />
          <input
            type="text"
            className="lr-search-input"
            placeholder="Rechercher par nom ou ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {sortedEmployees.length !== data.employees.length && (
            <span className="lr-search-count">
              {sortedEmployees.length} / {data.employees.length}
            </span>
          )}
        </div>
      )}

      {/* ── Table ── */}
      {data && (
        <div className="lr-table-card">
          {sortedEmployees.length === 0 ? (
            <div className="lr-empty">
              <TrendingUp size={36} />
              <p>
                {search
                  ? 'Aucun résultat pour cette recherche.'
                  : `Aucun employé en retard ≥ ${data.min_late} fois ce mois-ci. 🎉`
                }
              </p>
            </div>
          ) : (
            <div className="lr-table-wrap">
              <table className="lr-table">
                <thead>
                  <tr>
                    <th className="lr-th">#</th>
                    <th className="lr-th lr-th--sortable" onClick={() => toggleSort('user_id')}>
                      Employé <SortIcon col="user_id" />
                    </th>
                    <th
                      className="lr-th lr-th--sortable lr-th--center"
                      onClick={() => toggleSort('late_count')}
                    >
                      Retards <SortIcon col="late_count" />
                    </th>
                    <th className="lr-th lr-th--center">Présences</th>
                    <th
                      className="lr-th lr-th--sortable"
                      onClick={() => toggleSort('late_rate_pct')}
                    >
                      Taux <SortIcon col="late_rate_pct" />
                    </th>
                    <th className="lr-th" />
                  </tr>
                </thead>
                <tbody>
                  {sortedEmployees.map((emp, i) => (
                    <EmployeeRow
                      key={emp.user_id}
                      emp={emp}
                      rank={i + 1}
                      employeeName={getEmployeeName(emp.user_id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state before search ── */}
      {!data && !loading && !error && (
        <div className="lr-intro">
          <div className="lr-intro__icon"><AlertTriangle size={40} /></div>
          <p>
            Choisissez un mois, une année et un seuil, puis cliquez sur{' '}
            <strong>Analyser</strong>.
          </p>
          <p className="lr-intro__sub">
            Le rapport identifie tous les employés dont le nombre de retards
            dépasse le seuil sur la période sélectionnée.
          </p>
          <p className="lr-intro__sub">
            Par défaut, les <strong>HC (managers)</strong> sont exclus de l'analyse.
            Utilisez le filtre <em>Classification</em> pour les inclure.
          </p>
        </div>
      )}
    </div>
  );
};

export default LateReport;
