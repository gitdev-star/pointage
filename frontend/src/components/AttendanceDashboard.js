import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import './AttendanceDashboard.css';
import {
  Clock, Users, Download, Filter, Calendar, Timer,
  BarChart3, RefreshCw, Eye, X, AlertCircle, TrendingUp,
  ChevronLeft, ChevronRight, Search, FileDown
} from 'lucide-react';
// ✅ Import hrClient for authenticated HR API calls
import hrClient from '../api/hrClient';

// ── Performance: debounce hook ──────────────────────────────────────
function useDebounce(value, delay) {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const HRAttendanceDashboard = () => {
  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({});
  const [kpi, setKpi] = useState({ presents: null, late: null });
  const [totalActive, setTotalActive] = useState(null);
  const [kpiLoading, setKpiLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [availableIPs, setAvailableIPs] = useState([]);
  const [loadingIPs, setLoadingIPs] = useState(false);
  const [clockers, setClockers] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');

  // ✅ Employee map: { device_user_id (int) → full_name (string) }
  const [employeeMap, setEmployeeMap] = useState({});
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  const [filters, setFilters] = useState({
    user_id: '',
    date_from: sevenDaysAgoStr,
    date_to: todayStr,
    time_from: '',
    time_to: '',
    target_date: '',
    device_ip: '',
    period: '',
    skip: 0,
    limit: 1000,
  });

  const [analysisData, setAnalysisData] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterMode, setFilterMode] = useState('range');
  const abortRef = useRef(null);

  const API_BASE = process.env.REACT_APP_API_URL + '/attendance/';
  const DJANGO_API = 'http://192.168.8.210';
  const debouncedUserId = useDebounce(filters.user_id, 400);

  // ✅ Load all employees once on mount — build device_user_id → name map
  const fetchEmployeeMap = useCallback(async () => {
    // ── Perf: serve from sessionStorage cache, reload only if missing ──
    const CACHE_KEY = 'empMap_v1';
    try {
      const cached = sessionStorage.getItem(CACHE_KEY);
      if (cached) {
        setEmployeeMap(JSON.parse(cached));
        return;
      }
    } catch (_) {}

    setLoadingEmployees(true);
    try {
      const res = await hrClient.get('employees/', {
        params: { page_size: 5000, status: 'ACTIVE' }
      });
      const employees = res.data.results ?? res.data;
      const map = {};
      employees.forEach(e => {
        const displayId = e.employee_id ? parseInt(e.employee_id, 10) : null;
        if (e.device_user_id != null) {
          map[e.device_user_id] = {
            name: `${e.first_name} ${e.last_name}`.trim() || e.employee_id,
            empId: displayId,
          };
        } else if (e.employee_id) {
          const numId = parseInt(e.employee_id, 10);
          if (!isNaN(numId)) {
            map[numId] = {
              name: `${e.first_name} ${e.last_name}`.trim() || e.employee_id,
              empId: numId,
            };
          }
        }
      });
      try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(map)); } catch (_) {}
      setEmployeeMap(map);
    } catch (err) {
      console.warn('Could not load employee names:', err.message);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // ── Perf: memoize lookups so renders don't iterate the map ──
  const resolvedEmployees = useMemo(() => employeeMap, [employeeMap]);

  const getEmployeeName = (userId) => {
    if (!userId) return null;
    return resolvedEmployees[Number(userId)]?.name || null;
  };

  const getEmployeeId = (userId) => {
    if (!userId) return userId;
    return resolvedEmployees[Number(userId)]?.empId ?? userId;
  };

  const fetchClockers = useCallback(async () => {
    try {
      const response = await fetch(`${DJANGO_API}/api/clockers/`);
      if (response.ok) {
        const data = await response.json();
        setClockers(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching clockers:', err);
    }
  }, [DJANGO_API]);

  const getClockerName = (ip) => {
    const clocker = clockers.find(c => c.ip_address === ip);
    if (!clocker) return ip;
    return clocker.specific_name || clocker.name || ip;
  };

  const fetchAvailableIPs = useCallback(async () => {
    setLoadingIPs(true);
    try {
      const response = await fetch(`${API_BASE}available-ips`);
      if (response.ok) {
        const ips = await response.json();
        setAvailableIPs(ips);
      } else {
        await extractIPsFromData();
      }
    } catch (err) {
      console.error('Error fetching available IPs:', err);
      await extractIPsFromData();
    } finally {
      setLoadingIPs(false);
    }
  }, []);

  const extractIPsFromData = async () => {
    try {
      const response = await fetch(`${API_BASE}?limit=1000&skip=0`);
      if (response.ok) {
        const data = await response.json();
        const uniqueIPs = [...new Set(data.map(record => record.device_ip).filter(ip => ip))];
        setAvailableIPs(uniqueIPs.sort());
      }
    } catch (err) {
      console.error('Error extracting IPs from data:', err);
    }
  };

  const fetchAttendance = useCallback(async () => {
    // ── Perf: cancel any in-flight request before firing a new one ──
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterMode === 'period' && filters.period) {
        params.append('period', filters.period);
      } else if (filterMode === 'specific' && filters.target_date) {
        params.append('target_date', filters.target_date);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      } else {
        const dateFrom = filters.date_from?.trim() || sevenDaysAgoStr;
        const dateTo = filters.date_to?.trim() || todayStr;
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      }
      if (filters.user_id) {
        const userIdNum = Number(filters.user_id);
        if (!isNaN(userIdNum) && userIdNum > 0) params.append('user_id', userIdNum);
      }
      let deviceIPs = [];
      if (filters.device_ip) {
        deviceIPs = [filters.device_ip];
      } else if (selectedGroup) {
        deviceIPs = clockers.filter(c => c.group_name === selectedGroup).map(c => c.ip_address);
      }
      if (deviceIPs.length > 0) params.append('device_ip', deviceIPs.join(','));
      params.append('skip', filters.skip || 0);
      params.append('limit', filters.limit || 1000);

      const response = await fetch(`${API_BASE}grouped?${params.toString()}`, { signal });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const cleanData = Array.isArray(data) ? data : [];
      const totalCount = response.headers.get('X-Total-Count');
      setTotalRecords(totalCount ? parseInt(totalCount) : cleanData.length);
      setAttendanceData(cleanData);
      // ── Perf: run stats/kpi/analysis in parallel ──
      await Promise.all([fetchStats(), fetchKpi(), fetchAnalysis()]);
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(`Erreur de récupération : ${err.message}`);
      setAttendanceData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [filters, filterMode, sevenDaysAgoStr, todayStr, selectedGroup, clockers]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();
      if (filterMode === 'period' && filters.period) {
        params.append('period', filters.period);
      } else if (filterMode === 'specific' && filters.target_date) {
        params.append('target_date', filters.target_date);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      } else {
        params.append('date_from', filters.date_from || sevenDaysAgoStr);
        params.append('date_to', filters.date_to || todayStr);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      }
      if (filters.user_id) {
        const userIdNum = Number(filters.user_id);
        if (!isNaN(userIdNum) && userIdNum > 0) params.append('user_id', userIdNum);
      }
      let deviceIPs = [];
      if (filters.device_ip) deviceIPs = [filters.device_ip];
      else if (selectedGroup) deviceIPs = clockers.filter(c => c.group_name === selectedGroup).map(c => c.ip_address);
      if (deviceIPs.length > 0) params.append('device_ip', deviceIPs.join(','));
      const response = await fetch(`${API_BASE}stats?${params.toString()}`);
      if (response.ok) setStats(await response.json());
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchKpi = async () => {
    setKpiLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      // Default to today — update based on active filter
      let kpiDate = today;
      if (filterMode === 'specific' && filters.target_date) {
        kpiDate = filters.target_date;
      } else if (filterMode === 'period' && filters.period === 'yesterday') {
        kpiDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      } else if (filterMode === 'range' && filters.date_to) {
        kpiDate = filters.date_to;
      }
      const [kpiRes, empRes] = await Promise.all([
        fetch(`${API_BASE}kpi?target_date=${kpiDate}`),
        hrClient.get('employees/', { params: { status: 'ACTIVE', page_size: 1 } }),
      ]);
      if (kpiRes.ok) setKpi(await kpiRes.json());
      if (empRes.data) setTotalActive(empRes.data.count ?? null);
    } catch (err) {
      console.error('KPI error:', err);
    } finally {
      setKpiLoading(false);
    }
  };

  // Fetch per-employee analysis when user_id filter is active
  const fetchAnalysis = async () => {
    const uid = filters.user_id ? Number(filters.user_id) : null;
    if (!uid || isNaN(uid)) { setAnalysisData(null); return; }
    setAnalysisLoading(true);
    try {
      const dateFrom = filters.date_from || sevenDaysAgoStr;
      const dateTo   = filters.date_to   || todayStr;
      const res = await fetch(`${API_BASE}analysis/${uid}?date_from=${dateFrom}&date_to=${dateTo}`);
      if (res.ok) setAnalysisData(await res.json());
      else setAnalysisData(null);
    } catch { setAnalysisData(null); }
    finally { setAnalysisLoading(false); }
  };

  const fmtTime = (dt) => {
    if (!dt) return '—';
    try {
      const d = new Date(dt);
      return isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch { return '—'; }
  };

  const exportToExcel = () => {
    if (attendanceData.length === 0) { alert('Aucune donnée à exporter.'); return; }
    const headers = ['User ID', 'Nom', 'Date', 'Arrivée', 'Départ', 'Pointages'];
    const csvData = attendanceData.map(r => [
      getEmployeeId(r.user_id),
      getEmployeeName(r.user_id) || `ID:${r.user_id}`,
      r.attendance_date || r.date,
      r.arrival ? new Date(r.arrival).toLocaleTimeString('fr-FR') : '—',
      r.departure ? new Date(r.departure).toLocaleTimeString('fr-FR') : '—',
      r.punch_count || 1,
    ]);
    const csv = [headers, ...csvData].map(row => row.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleFilterChange = (key, value) => setFilters(prev => ({ ...prev, [key]: value, skip: 0 }));

  const clearFilters = () => {
    setFilters({
      user_id: '', date_from: sevenDaysAgoStr, date_to: todayStr,
      time_from: '', time_to: '', target_date: '', device_ip: '',
      period: '', skip: 0, limit: 200,
    });
    setFilterMode('range');
    setSelectedGroup('');
  };

  const handleQuickTimeFilter = (timeRange) => {
    const times = {
      morning: { from: '06:00', to: '12:00' },
      afternoon: { from: '12:00', to: '18:00' },
      evening: { from: '18:00', to: '23:59' },
      business: { from: '08:00', to: '17:00' },
      night: { from: '22:00', to: '06:00' },
    };
    if (times[timeRange]) {
      handleFilterChange('time_from', times[timeRange].from);
      handleFilterChange('time_to', times[timeRange].to);
    }
  };

  const formatDateTime = (str) => str ? new Date(str).toLocaleString('fr-FR') : '—';
  const formatDate = (str) => str ? new Date(str).toLocaleDateString('fr-FR') : '—';
  const formatTime = (str) => str ? new Date(str).toLocaleTimeString('fr-FR') : '—';

  const viewRecord = (rec) => { setSelectedRecord(rec); setShowModal(true); };
  const getCurrentPage = () => Math.floor(filters.skip / filters.limit) + 1;
  const getTotalPages = () => Math.ceil(totalRecords / filters.limit);
  const goToPage = (page) => handleFilterChange('skip', (page - 1) * filters.limit);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance, debouncedUserId]);
  useEffect(() => {
    fetchAvailableIPs();
    fetchClockers();
    fetchEmployeeMap();
    fetchKpi(); // ✅ Load employee names on mount
  }, []);

  const RecordModal = ({ record, onClose }) => {
    if (!record) return null;
    const empName = getEmployeeName(record.user_id);
    return (
      <div className="attendance-modal-backdrop">
        <div className="attendance-modal">
          <div className="modal-header">
            <h3>Détails du pointage</h3>
            <button onClick={onClose} className="modal-close-btn"><X /></button>
          </div>
          <div className="modal-content">
            <div className="modal-info-grid">
              <div>
                <p className="modal-label">ID employé(e)</p>
                <p className="modal-value">{getEmployeeId(record.user_id)}</p>
              </div>
              {/* ✅ Show employee name in modal */}
              {empName && (
                <div>
                  <p className="modal-label">Nom</p>
                  <p className="modal-value"><strong>{empName}</strong></p>
                </div>
              )}
              <div>
                <p className="modal-label">Clocker</p>
                <p className="modal-value">{getClockerName(record.device_ip)}</p>
              </div>
            </div>
            <div className="modal-info-item">
              <p className="modal-label">Date</p>
              <p className="modal-value">{formatDate(record.date || record.attendance_date)}</p>
            </div>
            <div className="modal-info-item">
              <p className="modal-label">Heure</p>
              <p className="modal-value">{formatTime(record.timestamp)}</p>
            </div>
            <div className="modal-info-item">
              <p className="modal-label">Horodatage complet</p>
              <p className="modal-value-small">{formatDateTime(record.timestamp)}</p>
            </div>
          </div>
          <div className="modal-actions">
            <button onClick={onClose} className="btn btn-blue">Fermer</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="attendance-dashboard">
      <div className="container">

        {/* Header */}
        <header className="attendance-header">
          <div>
            <h1>Tableau de bord RH</h1>
            <p>Suivi des pointages des employés avec filtrage avancé</p>
          </div>
          <div className="header-actions">
            <button onClick={fetchAttendance} disabled={loading} className="btn btn-blue">
              <RefreshCw className={`icon ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button onClick={exportToExcel} className="btn btn-green">
              <Download className="icon" />
              Exporter
            </button>
          </div>
        </header>

        {error && (
          <div className="error-alert">
            <AlertCircle className="icon" />
            <p>{error}</p>
          </div>
        )}

        {/* Stats Grid */}
        <section className="stats-grid">
          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Total Records</p>
                <p className="stats-value">{totalRecords || 0}</p>
              </div>
              <div className="stats-icon blue"><BarChart3 className="icon" /></div>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Pointages</p>
                <p className="stats-value">{stats.total_records || 0}</p>
              </div>
              <div className="stats-icon green"><Clock className="icon" /></div>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Utilisateurs uniques</p>
                <p className="stats-value">{stats.unique_users || 0}</p>
              </div>
              <div className="stats-icon purple"><Users className="icon" /></div>
            </div>
          </div>
          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Dernier pointage</p>
                <p className="stats-value-small">
                  {stats.latest_punch ? formatTime(stats.latest_punch) : '—'}
                </p>
              </div>
              <div className="stats-icon orange"><TrendingUp className="icon" /></div>
            </div>
          </div>
        </section>

        {/* KPI Today */}
        <section style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>

            {/* Présents */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', borderLeft: '4px solid #10b981' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', margin: '0 0 0.5rem 0' }}>{filterMode === 'specific' && filters.target_date ? `Présents le ${new Date(filters.target_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : filterMode === 'period' && filters.period === 'yesterday' ? "Présents hier" : "Présents aujourd'hui"}</p>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: '#10b981', margin: 0 }}>
                {kpiLoading ? '…' : (kpi.presents ?? '—')}
              </p>
              {/* Progress bar */}
              {!kpiLoading && kpi.presents != null && totalActive != null && totalActive > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      {kpi.date ? new Date(kpi.date + 'T00:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) : ''}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>
                      {Math.round(kpi.presents / totalActive * 100)}%
                    </span>
                  </div>
                  <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(100, Math.round(kpi.presents / totalActive * 100))}%`, background: '#10b981', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
                  </div>
                  <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '4px 0 0' }}>sur {totalActive.toLocaleString()} employés actifs</p>
                </div>
              )}
            </div>

            {/* Absents */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', borderLeft: '4px solid #ef4444' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', margin: '0 0 0.5rem 0' }}>{filterMode === 'specific' && filters.target_date ? `Absents le ${new Date(filters.target_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : filterMode === 'period' && filters.period === 'yesterday' ? "Absents hier" : "Absents aujourd'hui"}</p>
              {(() => {
                const absents = kpi.presents != null && totalActive != null ? Math.max(0, totalActive - kpi.presents) : null;
                const pct = absents != null && totalActive > 0 ? Math.round(absents / totalActive * 100) : null;
                return (
                  <>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#ef4444', margin: 0 }}>
                      {kpiLoading ? '…' : (absents ?? '—')}
                    </p>
                    {!kpiLoading && absents != null && totalActive > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>sur {totalActive.toLocaleString()} actifs</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>{pct}%</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, background: '#ef4444', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '4px 0 0' }}>taux d'absentéisme</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* En retard */}
            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '1rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid rgba(0,0,0,0.05)', borderLeft: '4px solid #f59e0b' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6b7280', margin: '0 0 0.5rem 0' }}>{filterMode === 'specific' && filters.target_date ? `En retard le ${new Date(filters.target_date + 'T00:00:00').toLocaleDateString('fr-FR')}` : filterMode === 'period' && filters.period === 'yesterday' ? "En retard hier" : "En retard aujourd'hui"}</p>
              {(() => {
                const pct = kpi.late != null && kpi.presents > 0 ? Math.round(kpi.late / kpi.presents * 100) : null;
                return (
                  <>
                    <p style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b', margin: 0 }}>
                      {kpiLoading ? '…' : (kpi.late ?? '—')}
                    </p>
                    {!kpiLoading && kpi.late != null && kpi.presents > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, color: '#9ca3af' }}>sur {kpi.presents} présents</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b' }}>{pct}%</span>
                        </div>
                        <div style={{ background: '#e5e7eb', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, pct)}%`, background: '#f59e0b', height: '100%', borderRadius: 4, transition: 'width 0.5s ease' }} />
                        </div>
                        <p style={{ fontSize: '0.7rem', color: '#9ca3af', margin: '4px 0 0' }}>premier pointage après 07h40</p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

          </div>
        </section>

        {/* Filters */}
        <section className="filters-section">
          <div className="filters-header">
            <h2><Filter className="icon" />Filtres avancés</h2>
          </div>
          <div className="filters-content">
            <div className="filter-mode-section">
              <label className="filter-mode-label">Mode de filtrage</label>
              <div className="filter-mode-buttons">
                <button onClick={() => setFilterMode('range')} className={`filter-mode-btn ${filterMode === 'range' ? 'active' : ''}`}>
                  <Calendar className="icon" />Plage de dates
                </button>
                <button onClick={() => setFilterMode('specific')} className={`filter-mode-btn ${filterMode === 'specific' ? 'active' : ''}`}>
                  <Timer className="icon" />Date spécifique
                </button>
                <button onClick={() => setFilterMode('period')} className={`filter-mode-btn ${filterMode === 'period' ? 'active' : ''}`}>
                  <Clock className="icon" />Période prédéfinie
                </button>
              </div>
            </div>

            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">ID Employé(e)</label>
                <input type="number" placeholder="ID Utilisateur" value={filters.user_id}
                  onChange={(e) => { const val = e.target.value; if (val === '' || /^\d*$/.test(val)) handleFilterChange('user_id', val); }}
                  className="filter-input" />
                {/* ✅ Show name hint when user_id is typed */}
                {filters.user_id && (
                  <small style={{ color: '#1976d2', marginTop: 2, display: 'block' }}>
                    {getEmployeeName(filters.user_id) || (loadingEmployees ? 'Chargement…' : 'Employé inconnu')}
                  </small>
                )}
              </div>

              <div className="filter-group">
                <label className="filter-label">Groupe de clockers</label>
                <select value={selectedGroup}
                  onChange={(e) => { setSelectedGroup(e.target.value); handleFilterChange('device_ip', ''); }}
                  className="filter-input">
                  <option value="">-- Tous les groupes --</option>
                  {Array.from(new Set(clockers.map(c => c.group_name).filter(Boolean))).map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  Clocker{loadingIPs && <span className="loading-text"> (Chargement...)</span>}
                </label>
                <div className="ip-filter-container">
                  {availableIPs.length > 0 ? (
                    <select value={filters.device_ip}
                      onChange={(e) => handleFilterChange('device_ip', e.target.value)}
                      className="filter-input" disabled={loadingIPs}>
                      <option value="">-- Tous les clockers --</option>
                      {availableIPs
                        .filter(ip => !selectedGroup || clockers.find(c => c.ip_address === ip)?.group_name === selectedGroup)
                        .map((ip) => (
                          <option key={ip} value={ip}>{getClockerName(ip)}</option>
                        ))}
                    </select>
                  ) : (
                    <input type="text" placeholder="Clocker..." value={filters.device_ip}
                      onChange={(e) => handleFilterChange('device_ip', e.target.value)}
                      className="filter-input" disabled={loadingIPs} />
                  )}
                  <button onClick={fetchAvailableIPs} className="refresh-ip-btn" disabled={loadingIPs} title="Actualiser">
                    <RefreshCw className={`icon small ${loadingIPs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {filterMode === 'range' && (
                <>
                  <div className="filter-group">
                    <label className="filter-label">Date de début</label>
                    <input type="date" value={filters.date_from}
                      onChange={(e) => handleFilterChange('date_from', e.target.value)} className="filter-input" />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Date de fin</label>
                    <input type="date" value={filters.date_to}
                      onChange={(e) => handleFilterChange('date_to', e.target.value)} className="filter-input" />
                  </div>
                </>
              )}
              {filterMode === 'specific' && (
                <div className="filter-group">
                  <label className="filter-label">Date cible</label>
                  <input type="date" value={filters.target_date}
                    onChange={(e) => handleFilterChange('target_date', e.target.value)} className="filter-input" />
                </div>
              )}
              {filterMode === 'period' && (
                <div className="filter-group">
                  <label className="filter-label">Période</label>
                  <select value={filters.period}
                    onChange={(e) => handleFilterChange('period', e.target.value)} className="filter-input">
                    <option value="">-- Sélectionner --</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="yesterday">Hier</option>
                    <option value="this_week">Cette semaine</option>
                    <option value="last_week">Semaine dernière</option>
                  </select>
                </div>
              )}
            </div>

            {(filterMode === 'range' || filterMode === 'specific') && (
              <>
                <div className="time-filters-grid">
                  <div className="filter-group">
                    <label className="filter-label">Heure de début</label>
                    <input type="time" value={filters.time_from}
                      onChange={(e) => handleFilterChange('time_from', e.target.value)} className="filter-input" />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Heure de fin</label>
                    <input type="time" value={filters.time_to}
                      onChange={(e) => handleFilterChange('time_to', e.target.value)} className="filter-input" />
                  </div>
                </div>
                <div className="quick-time-filters">
                  <label className="quick-time-label">Créneaux rapides</label>
                  <div className="quick-time-buttons">
                    {[
                      { key: 'morning',   label: 'Matin (6h-12h)' },
                      { key: 'afternoon', label: 'Après-midi (12h-18h)' },
                      { key: 'evening',   label: 'Soir (18h-24h)' },
                      { key: 'business',  label: 'Horaires bureau (8h-17h)' },
                    ].map(t => (
                      <button key={t.key} onClick={() => handleQuickTimeFilter(t.key)}
                        className={`quick-time-btn ${t.key}`}>{t.label}</button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <div className="filter-actions">
              <button onClick={fetchAttendance} className="btn btn-blue">
                <Search className="icon" />Rechercher
              </button>
              <button onClick={clearFilters} className="btn btn-gray">Réinitialiser</button>
            </div>
          </div>
        </section>

        {/* Data Table */}
        <section className="attendance-table-section">
          <div className="table-header">
            <h2>Enregistrements de pointage</h2>
            <p>
              Affichage de {attendanceData.length} sur {totalRecords} enregistrements
              {/* ✅ Show employee map load status */}
              {loadingEmployees && <span style={{ color: '#9e9e9e', marginLeft: 8, fontSize: 12 }}>• Chargement des noms…</span>}
            </p>
          </div>

          <div className="table-scroll">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Date</th>
                  <th style={{ color: '#10b981' }}>Arrivée</th>
                  <th style={{ color: '#ef4444' }}>Départ</th>
                  <th>Pointages</th>
                  <th>Clocker</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((record, index) => {
                  const empName = getEmployeeName(record.user_id);
                  return (
                    <tr key={`${record.user_id}-${record.timestamp}-${index}`}>
                      <td>
                        <div className="user-cell">
                          <div className="user-avatar"><Users className="icon" /></div>
                          <div>
                            {empName
                              ? <div className="user-id"><strong>{empName}</strong></div>
                              : <div className="user-id">ID: {record.user_id}</div>
                            }
                            {empName && (
                              <div style={{ fontSize: 11, color: '#9e9e9e' }}>#{getEmployeeId(record.user_id)}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="date-cell">{formatDate(record.date || record.attendance_date)}</td>
                      <td style={{ color: record.arrival ? '#10b981' : '#9e9e9e', fontWeight: 600, fontSize: 13 }}>
                        {record.arrival ? fmtTime(record.arrival) : '—'}
                      </td>
                      <td style={{ color: record.departure ? '#ef4444' : '#9e9e9e', fontWeight: 600, fontSize: 13 }}>
                        {record.departure ? fmtTime(record.departure) : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                        {record.punch_count || 1}
                      </td>
                      <td className="ip-cell">{getClockerName(record.device_ip)}</td>
                      <td>
                        <button onClick={() => viewRecord(record)} className="btn btn-view">
                          <Eye className="icon" />Voir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!loading && attendanceData.length === 0 && (
              <div className="no-data">
                <Users className="icon large" />
                <p className="no-data-title">Aucun pointage trouvé</p>
                <p className="no-data-subtitle">Essayez d'ajuster vos filtres de recherche</p>
              </div>
            )}
            {loading && (
              <div className="loading-state">
                <RefreshCw className="icon large animate-spin" />
                <p>Chargement des données...</p>
              </div>
            )}
          </div>
        </section>

        {/* Pagination */}
        <section className="pagination-section">
          <div className="pagination-content">
            <div className="pagination-info">
              <label>Résultats par page:</label>
              <select value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                className="pagination-select">
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
                <option value={1000}>1000</option>
              </select>
            </div>
            <div className="pagination-stats">
              <span>Page {getCurrentPage()} sur {getTotalPages()}</span>
              <span className="pagination-range">
                ({filters.skip + 1} - {Math.min(filters.skip + attendanceData.length, totalRecords)} sur {totalRecords})
              </span>
            </div>
            <div className="pagination-controls">
              <button onClick={() => handleFilterChange('skip', 0)} disabled={filters.skip === 0} className="pagination-btn">Premier</button>
              <button onClick={() => handleFilterChange('skip', Math.max(0, filters.skip - filters.limit))} disabled={filters.skip === 0} className="pagination-btn">
                <ChevronLeft className="icon" />Précédent
              </button>
              {(() => {
                const currentPage = getCurrentPage();
                const totalPages = getTotalPages();
                const pages = [];
                const maxPagesToShow = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
                if (endPage - startPage + 1 < maxPagesToShow) startPage = Math.max(1, endPage - maxPagesToShow + 1);
                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button key={i} onClick={() => goToPage(i)}
                      className={`pagination-btn ${i === currentPage ? 'active' : ''}`}>{i}</button>
                  );
                }
                return pages;
              })()}
              <button onClick={() => handleFilterChange('skip', filters.skip + filters.limit)}
                disabled={attendanceData.length < filters.limit} className="pagination-btn">
                Suivant<ChevronRight className="icon" />
              </button>
              <button onClick={() => goToPage(getTotalPages())}
                disabled={getCurrentPage() === getTotalPages()} className="pagination-btn">Dernier</button>
            </div>
          </div>
        </section>

        {/* Summary */}
        <section className="summary-section">
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon blue"><Clock className="icon" /></div>
              <h3>Filtrage en temps réel</h3>
              <p>Filtrez par heure, date spécifique ou plage de dates</p>
            </div>
            <div className="summary-card">
              <div className="summary-icon green"><BarChart3 className="icon" /></div>
              <h3>Statistiques détaillées</h3>
              <p>Analyses complètes avec compteurs en temps réel</p>
            </div>
            <div className="summary-card">
              <div className="summary-icon purple"><FileDown className="icon" /></div>
              <h3>Export flexible</h3>
              <p>Exportez les données filtrées en CSV</p>
            </div>
          </div>
        </section>

        <footer className="footer-info">
          <div className="footer-content">
            <Clock className="icon" />
            Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
          </div>
          <p>Système de pointage HR - Version 2.0 avec filtrage temporel avancé</p>
        </footer>
      </div>

      {showModal && (
        <RecordModal record={selectedRecord} onClose={() => { setSelectedRecord(null); setShowModal(false); }} />
      )}
    </div>
  );
};

export default HRAttendanceDashboard;
