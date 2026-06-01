import React, { useState, useEffect } from 'react';
import {
  Clock, User, TrendingUp, TrendingDown, Award,
  Calendar, AlertTriangle, Download,
  Search, Sunrise, Sunset, Coffee
} from 'lucide-react';
import './AttendanceAnalysis.css';
import { useSearchParams } from 'react-router-dom';

const API_BASE = (process.env.REACT_APP_API_URL || '') + '/attendance';

// Helpers
const parseDateLike = (v) => {
  if (!v) return null;
  try {
    if (v instanceof Date) return v;
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T00:00:00');
    return new Date(v);
  } catch {
    return null;
  }
};

const fmtTime = (dt) => {
  const d = parseDateLike(dt);
  if (!d || isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
};

const fmtHours = (h) => {
  if (h == null || Number.isNaN(h)) return '—';
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}h${mm.toString().padStart(2, '0')}`;
};

const fmtDate = (d) => {
  const p = parseDateLike(d);
  if (!p) return '—';
  return p.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Small components
const KpiCard = ({ icon: Icon, label, value, sub, accent }) => (
  <div className={`kpi-card kpi-card--${accent}`}>
    <div className="kpi-card__icon"><Icon size={20} /></div>
    <div className="kpi-card__body">
      <div className="kpi-card__value">{value}</div>
      <div className="kpi-card__label">{label}</div>
      {sub && <div className="kpi-card__sub">{sub}</div>}
    </div>
  </div>
);

const StatusBadge = ({ type }) => {
  const map = {
    late: { label: 'Retard', cls: 'badge--late' },
    early_leave: { label: 'Départ tôt', cls: 'badge--early' },
    overtime: { label: 'Heures sup.', cls: 'badge--overtime' },
    weekend: { label: 'Week-end', cls: 'badge--weekend' },
    on_time: { label: "À l'heure", cls: 'badge--ok' },
  };
  const m = map[type];
  if (!m) return null;
  return <span className={`status-badge ${m.cls}`}>{m.label}</span>;
};

// Main
const AttendanceAnalysis = () => {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [searchParams] = useSearchParams();
  const [userId, setUserId] = useState(searchParams.get('user_id') || '');
  const [employeeName, setEmployeeName] = useState(searchParams.get('name') || '');
  const fromFiche = !!searchParams.get('user_id');
  const [dateFrom, setDateFrom] = useState(firstOfMonth);
  const [dateTo, setDateTo] = useState(today);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (searchParams.get('user_id')) {
      setTimeout(() => {
        document.getElementById('btn-analyse')?.click();
      }, 300);
    }
  }, []);

  const handleSearch = async () => {
    setError(null);
    setData(null);
    const uid = (userId || '').toString().trim();
    if (!uid) return setError('Veuillez saisir un ID employé');
    if (!dateFrom || !dateTo) return setError('Veuillez sélectionner une plage de dates');

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE}/analysis/${uid}?date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.status === 404) throw new Error('Aucun pointage trouvé pour cet employé sur cette période.');
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(txt || `Erreur ${res.status}`);
      }
      const json = await res.json();
      console.log('Backend response:', json); // ← DEBUG
      console.log('First day:', json.days?.[0]); // ← DEBUG
      setData(json);
    } catch (e) {
      setError(e.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = async () => {
    if (!data) return;
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE}/analysis/${userId}/export?date_from=${dateFrom}&date_to=${dateTo}`;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

      if (!res.ok) {
        throw new Error(`Erreur ${res.status}: ${res.statusText}`);
      }

      const blob = await res.blob();
      const filename = `analyse_${userId}_${dateFrom}_${dateTo}.csv`;

      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
    } catch (e) {
      console.error('Export error:', e);
      alert(e.message || 'Erreur lors de l\'export CSV');
    }
  };

  const getDayStatuses = (d) => {
    const s = [];
    if (d.is_weekend) s.push('weekend');
    if (d.is_late) s.push('late');
    if (d.is_early_leave) s.push('early_leave');
    if (d.is_overtime) s.push('overtime');
    if (!d.is_late && !d.is_early_leave && !d.is_overtime && !d.is_weekend) s.push('on_time');
    return s;
  };

  return (
    <div className="analysis-page">
      <div className="analysis-page__header">
        <div className="analysis-page__title-block">
          <h1>Analyse des présences</h1>
          <p>Retards · Départs anticipés · Heures supplémentaires · Temps de travail</p>
        </div>
        {data && <button className="analysis-btn analysis-btn--export" onClick={exportCSV}><Download size={15} /> Exporter</button>}
      </div>

      <div className="analysis-search">
        <div className="analysis-search__field">
          <label>ID Employé(e)</label>
          <input type="number" placeholder="ex: 42" value={userId} onChange={e => !fromFiche && setUserId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} readOnly={fromFiche} style={fromFiche ? {backgroundColor: "#f5f5f5", cursor: "not-allowed"} : {}} />
        </div>
        <div className="analysis-search__field"><label>Du</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div>
        <div className="analysis-search__field"><label>Au</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div>
        <button id="btn-analyse" className="analysis-btn analysis-btn--search" onClick={handleSearch} disabled={loading}><Search size={15} /> {loading ? 'Analyse...' : 'Analyser'}</button>
      </div>

      {error && <div className="analysis-error"><AlertTriangle size={16} />{error}</div>}

      {data && (
        <div className="analysis-results">
          <div className="analysis-summary-bar">
            <div className="analysis-summary-bar__left">
              <div className="analysis-summary-bar__avatar"><User size={22} /></div>
              <div>
                <div className="analysis-summary-bar__name">{employeeName || `Employé #${data.user_id}`}</div>
                <div className="analysis-summary-bar__period">{fmtDate(data.date_from)} → {fmtDate(data.date_to)} · {data.total_days_present} jour(s)</div>
              </div>
            </div>
            <div className="analysis-summary-bar__right">
              {data.total_days_late > 0 && <span className="summary-pill summary-pill--warn"><AlertTriangle size={12} /> {data.total_days_late} retard(s)</span>}
              {data.total_days_overtime > 0 && <span className="summary-pill summary-pill--good"><TrendingUp size={12} /> {data.total_days_overtime} jour(s) heures sup.</span>}
              {data.total_weekend_days > 0 && <span className="summary-pill summary-pill--info"><Calendar size={12} /> {data.total_weekend_days} week-end(s)</span>}
            </div>
          </div>

          <div className="analysis-kpi-grid">
            <KpiCard icon={Clock} label="Heures totales" value={fmtHours(data.total_hours_worked)} accent="blue" />
            <KpiCard icon={Coffee} label="Moy. par jour" value={fmtHours(data.average_hours_per_day)} accent="teal" />
            <KpiCard icon={AlertTriangle} label="Retards" value={data.total_days_late} accent="orange" sub={`sur ${data.total_days_present} jours`} />
            <KpiCard icon={TrendingDown} label="Départs anticipés" value={data.total_days_early_leave} accent="red" sub="avant 16h27" />
            <KpiCard icon={TrendingUp} label="Heures sup. totales" value={fmtHours(data.total_overtime_hours || 0)} accent="purple" sub={`${data.total_days_overtime} jour(s)`} />
            <KpiCard icon={Calendar} label="Week-ends" value={data.total_weekend_days} accent="indigo" />
          </div>

          <div className="analysis-table-card">
            <div className="analysis-table-card__header">
              <h3>Détail par jour</h3>
              <span className="analysis-table-card__count">{(data.days || []).length} jour(s)</span>
            </div>
            <div className="analysis-table-wrap">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Jour</th>
                    <th><span className="th-icon"><Sunrise size={13} /></span> Arrivée</th>
                    <th><span className="th-icon"><Sunset size={13} /></span> Départ</th>
                    <th><span className="th-icon"><Clock size={13} /></span> Heures</th>
                    <th><span className="th-icon"><TrendingUp size={13} /></span> H.sup.</th>
                    <th>Pointages</th><th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.days || []).map((d) => {
                    return (
                      <tr key={d.date} className={[
                        d.is_weekend ? 'tr--weekend' : '',
                        d.is_late ? 'tr--late' : '',
                        d.is_overtime ? 'tr--overtime' : ''
                      ].filter(Boolean).join(' ')}>
                        <td className="td--date">{fmtDate(d.date)}</td>
                        <td className="td--day">{d.day_name}</td>
                        <td className={`td--time ${d.is_late ? 'td--time-bad' : 'td--time-ok'}`}>{fmtTime(d.arrival)}</td>
                        <td className={`td--time ${d.is_early_leave ? 'td--time-bad' : d.is_overtime ? 'td--time-overtime' : 'td--time-ok'}`}>{fmtTime(d.departure)}</td>
                        <td className="td--hours">{fmtHours(d.hours_worked)}</td>
                        <td className="td--hours td--hours-overtime">{d.overtime_hours > 0 ? fmtHours(d.overtime_hours) : '—'}</td>
                        <td className="td--punches">{d.punch_count}</td>
                        <td className="td--status">{getDayStatuses(d).map(s => <StatusBadge key={s} type={s} />)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div className="analysis-empty">
          <Award size={40} />
          <p>Saisissez un ID employé et une plage de dates, puis cliquez sur <strong>Analyser</strong>.</p>
        </div>
      )}
    </div>
  );
};

export default AttendanceAnalysis;
