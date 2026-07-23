import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import '../../../components/AttendanceDashboard.css'
import {
  Clock, Users, Download, Filter, Calendar, Timer,
  BarChart3, RefreshCw, Eye, X, AlertCircle, TrendingUp,
  ChevronLeft, ChevronRight, Search, FileDown
} from 'lucide-react';
// ✅ Import hrClient for authenticated HR API calls
import hrClient from '../../../api/hrClient';
import cachet from '../../../assets/cachet.png'

const JETON_DESIGNS = [
  { id: 'classic',  emoji: '🍽️', label: 'Classique',   color: '#333' },
  { id: 'pizza',    emoji: '🍕', label: 'Pizza',        color: '#e63946' },
  { id: 'salad',    emoji: '🥗', label: 'Salade',       color: '#2a9d8f' },
  { id: 'rice',     emoji: '🍱', label: 'Bento',        color: '#e76f51' },
  { id: 'coffee',   emoji: '☕', label: 'Café',          color: '#6f4e37' },
  { id: 'fruit',    emoji: '🍎', label: 'Fruit',        color: '#d62828' },
  { id: 'star',     emoji: '⭐', label: 'Étoile',        color: '#f4a261' },
  { id: 'birthday', emoji: '🎉', label: 'Fête',         color: '#9c27b0' },
];

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
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(JETON_DESIGNS[0]);

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
  const [classificationFilter, setClassificationFilter] = useState('');
  const [scheduleMap, setScheduleMap] = useState({}); // { employeePkId: "HH:MM:SS" }
  const [earlyDepartureFilter, setEarlyDepartureFilter] = useState(false);


const fetchScheduleMap = useCallback(async () => {
  try {
    const res = await hrClient.get('employees/work-schedules/', {
      params: { is_active: true, page_size: 5000 }
    });
    const schedules = res.data.results ?? res.data;
    const map = {};
    schedules.forEach(s => {
      if (s.employee && s.standard_end) map[s.employee] = s.standard_end;
    });
    setScheduleMap(map);
  } catch (err) {
    console.warn('Could not load work schedules:', err.message);
  }
}, []);

  const API_BASE = process.env.REACT_APP_API_URL + '/attendance/';
  const debouncedUserId = useDebounce(filters.user_id, 400);

const fetchEmployeeMap = useCallback(async () => {
  const CACHE_KEY = 'empMap_v3'; // ⚠️ bump la clé de cache car on change la structure
  try {
    // const cached = sessionStorage.getItem(CACHE_KEY);
    // if (cached) {
    //   setEmployeeMap(JSON.parse(cached));
    //   return;
    // }
  } catch (_) {}

  setLoadingEmployees(true);
  try {
    const res = await hrClient.get('employees/', {
      params: { page_size: 5000, status: 'ACTIVE' }
    });
    const employees = res.data.results ?? res.data;
    console.log('Exemple employé:', employees[0]);
    const map = {};
    employees.forEach(e => {
      const displayId = e.employee_id ? parseInt(e.employee_id, 10) : null;
      const entry = {
        name: `${e.first_name} ${e.last_name}`.trim() || e.employee_id,
        empId: displayId,
        pkId: e.id,
        classification: e.classification_name || null,  // ✅ adapte au nom réel du champ
        section: e.section_name || null,
      };
      if (e.device_user_id != null) {
        map[e.device_user_id] = entry;
      } else if (e.employee_id) {
        const numId = parseInt(e.employee_id, 10);
        if (!isNaN(numId)) map[numId] = entry;
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

const getEmployeeClassification = (userId) => {
  if (!userId) return null;
  return resolvedEmployees[Number(userId)]?.classification || null;
};

const getEmployeeSection = (userId) => {
  if (!userId) return null;
  return resolvedEmployees[Number(userId)]?.section || null;
};

  // ── Perf: memoize lookups so renders don't iterate the map ──
  const resolvedEmployees = useMemo(() => employeeMap, [employeeMap]);

    const availableClassifications = useMemo(() => {
      const set = new Set(
        Object.values(resolvedEmployees)
          .map(e => e.classification)
          .filter(Boolean)
      );
      return Array.from(set).sort();
    }, [resolvedEmployees]);

    console.log("availableClassifications:", availableClassifications)

  const getEmployeeName = (userId) => {
    if (!userId) return null;
    return resolvedEmployees[Number(userId)]?.name || null;
  };

  const getEmployeeId = (userId) => {
    if (!userId) return userId;
    return resolvedEmployees[Number(userId)]?.empId ?? userId;
  };

  const formatEmployeeId = (userId) => {
    const id = getEmployeeId(userId);
    if (id === null || id === undefined || id === '') return '—';
    return String(id).padStart(6, '0');
  };

  const fetchClockers = useCallback(async () => {
    try {
      const url = (process.env.REACT_APP_CLOCKERS_URL || 'https://192.168.8.210/api/clockers') + '/';
      const res = await fetch(url);
      if (res.ok) setClockers(await res.json());
    } catch (err) {
      console.error('Error fetching clockers:', err);
    }
  }, []);

  const getClockerName = (ip) => {
    const clocker = clockers.find(c => c.ip_address === ip);
    if (!clocker) return ip;
    return clocker.specific_name || clocker.name || ip;
  };

const fetchAvailableIPs = useCallback(async () => {
  setLoadingIPs(true);
  try {
    const response = await hrClient.get(`${API_BASE}available-ips`);
    setAvailableIPs(response.data);
  } catch (err) {
    console.error('Error fetching available IPs:', err);
    await extractIPsFromData();
  } finally {
    setLoadingIPs(false);
  }
}, []);

const extractIPsFromData = async () => {
  try {
    const response = await hrClient.get(`${API_BASE}?limit=1000&skip=0`);
    const data = response.data;
    const uniqueIPs = [...new Set(data.map(record => record.device_ip).filter(ip => ip))];
    setAvailableIPs(uniqueIPs.sort());
  } catch (err) {
    console.error('Error extracting IPs from data:', err);
  }
};

const GLOBAL_STANDARD_END = '16:30:00'; // fallback pour les employés sans WorkSchedule personnalisé

const isEarlyDeparture = (record) => {
  if (!record.departure) return false;
  const emp = resolvedEmployees[Number(record.user_id)];
  if (!emp?.pkId) return false;
  // Utilise l'horaire personnalisé (employé/section/département) s'il existe,
  // sinon retombe sur l'horaire standard global 7h30-16h30
  const standardEnd = scheduleMap[emp.pkId] || GLOBAL_STANDARD_END;
  const depTime = new Date(record.departure).toTimeString().slice(0, 8); // "HH:MM:SS"
  return depTime < standardEnd;
};

const OVERTIME_THRESHOLD_MINUTES = 30;
const STANDARD_WORK_HOURS_MS = 9 * 60 * 60 * 1000; // 9h de travail attendu
const STANDARD_START_HOUR = 7;
const STANDARD_START_MINUTE = 30;

const computeOvertimeMinutes = (record) => {
  if (!record.arrival || !record.departure) return 0;
  const arrivalDate = new Date(record.arrival);
  const departureDate = new Date(record.departure);

  const standardStartDate = new Date(arrivalDate);
  standardStartDate.setHours(STANDARD_START_HOUR, STANDARD_START_MINUTE, 0, 0);

  // Effective start = max(arrivée, 7h30) — une arrivée précoce ne fait pas avancer le décompte
  const effectiveStart = arrivalDate > standardStartDate ? arrivalDate : standardStartDate;

  const normalDepartureDate = new Date(effectiveStart.getTime() + STANDARD_WORK_HOURS_MS);
  const diffMinutes = Math.round((departureDate - normalDepartureDate) / 60000);
  if (diffMinutes <= OVERTIME_THRESHOLD_MINUTES) return 0;
  return diffMinutes;
};

const fmtOvertimeMinutes = (mins) => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
};

const filteredAttendanceData = useMemo(() => {
  let data = attendanceData;
  if (classificationFilter) {
    data = data.filter(r => getEmployeeClassification(r.user_id) === classificationFilter);
  }
  if (earlyDepartureFilter) {
    data = data.filter(r => isEarlyDeparture(r));
  }
  return data;
}, [attendanceData, classificationFilter, earlyDepartureFilter, resolvedEmployees, scheduleMap]);

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

      const response = await hrClient.get(`${API_BASE}grouped?${params.toString()}`, { signal });
      const data = response.data;
      const cleanData = Array.isArray(data) ? data : [];
      const totalCount = response.headers['x-total-count'];
      setTotalRecords(totalCount ? parseInt(totalCount) : cleanData.length);
      setAttendanceData(cleanData);
      await Promise.all([fetchStats(), fetchKpi(), fetchAnalysis()]);
    } catch (err) {
  if (err.code === 'ERR_CANCELED') return;
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
      else if (selectedGroup) deviceIPs = clockers.filter(c => c.group_name === selectedGroup && c.ip_address).map(c => c.ip_address);
      if (deviceIPs.length > 0) params.append('device_ip', deviceIPs.join(','));
      const response = await hrClient.get(`${API_BASE}stats?${params.toString()}`);
      setStats(response.data);
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
      hrClient.get(`${API_BASE}kpi?target_date=${kpiDate}`),
      hrClient.get('employees/', { params: { status: 'ACTIVE', page_size: 1 } }),
    ]);
    setKpi(kpiRes.data);
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
      const res = await hrClient.get(`${API_BASE}analysis/${uid}?date_from=${dateFrom}&date_to=${dateTo}`);
      setAnalysisData(res.data);
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

const exportToExcel = async () => {
  try {
    setLoading(true);
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
    params.append('skip', 0);
    params.append('limit', 50000); // couvre tout l'ensemble filtré, pas juste la page affichée

    const response = await hrClient.get(`${API_BASE}grouped?${params.toString()}`);
    let allData = Array.isArray(response.data) ? response.data : [];

    if (classificationFilter) {
      allData = allData.filter(r => getEmployeeClassification(r.user_id) === classificationFilter);
    }
    if (earlyDepartureFilter) {
      allData = allData.filter(r => isEarlyDeparture(r));
    }

    if (allData.length === 0) { alert('Aucune donnée à exporter.'); return; }

    const headers = ['User ID', 'Nom', 'Date', 'Arrivée', 'Départ', 'Heure sup.', 'Pointages'];
    const csvData = allData.map(r => [
      formatEmployeeId(r.user_id) ? `="${formatEmployeeId(r.user_id)}"` : '—',
      getEmployeeName(r.user_id) || `ID:${r.user_id}`,
      r.attendance_date || r.date,
      r.arrival ? new Date(r.arrival).toLocaleTimeString('fr-FR') : '—',
      r.departure ? new Date(r.departure).toLocaleTimeString('fr-FR') : '—',
      fmtOvertimeMinutes(computeOvertimeMinutes(r)),
      r.punch_count || 1,
    ]);
    const csv = [headers, ...csvData].map(row => row.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Synthese_presence_mensuelle_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert(`Erreur lors de l'export : ${err.message}`);
  } finally {
    setLoading(false);
  }
};

const generateJetonsCantine = (design) => {
  const eligibleData = filteredAttendanceData.filter(
    r => getEmployeeClassification(r.user_id) !== 'HC'
  );
  if (eligibleData.length === 0) { alert('Aucun employé éligible pour générer des jetons.'); return; }

  const todayLabel = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  });

  const cachetUrl = new URL(cachet, window.location.origin).href;

  const bySection = {};
  eligibleData.forEach(r => {
    const sectionName = getEmployeeSection(r.user_id) || 'Section non renseignée';
    if (!bySection[sectionName]) bySection[sectionName] = [];
    bySection[sectionName].push(r);
  });
  const sortedSectionNames = Object.keys(bySection).sort();

  const JETONS_PAR_PAGE = 25;

  // ✅ le design choisi remplace/complète le cachet
  const jetonHtml = `
    <div class="jeton" style="border-color: ${design.color}66;">
      <div class="jeton-icon" style="color: ${design.color};">${design.emoji}</div>
      <div class="jeton-cachet"><img src="${cachetUrl}" alt="cachet pbi" /></div>
      <div class="jeton-date" style="color: ${design.color};">${todayLabel}</div>
    </div>
  `;

  const pagesHtml = sortedSectionNames.map(sectionName => {
    const employesSection = bySection[sectionName];
    const totalPagesSection = Math.ceil(employesSection.length / JETONS_PAR_PAGE);

    return Array.from({ length: totalPagesSection }, (_, pageIndex) => {
      const remaining = employesSection.length - pageIndex * JETONS_PAR_PAGE;
      const jetonsSurCettePage = Math.min(JETONS_PAR_PAGE, remaining);
      const jetons = Array.from({ length: jetonsSurCettePage }, () => jetonHtml).join('');
      const suffix = totalPagesSection > 1 ? ` (page ${pageIndex + 1}/${totalPagesSection})` : '';

      return `
        <div class="page">
          <div class="section-title">${sectionName}${suffix}</div>
          <div class="jetons-grid">${jetons}</div>
        </div>
      `;
    }).join('');
  }).join('');

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>Jetons cantine - ${todayLabel}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @page { size: A4 portrait; margin: 8mm; }
        body { font-family: Arial, sans-serif; }
        .page { page-break-after: always; }
        .page:last-child { page-break-after: auto; }
        .section-title {
          font-size: 16px; font-weight: 700; text-align: center;
          padding: 3mm 0; margin-bottom: 3mm;
          border-bottom: 2px solid #333; text-transform: uppercase;
        }
        .jetons-grid {
          display: grid; grid-template-columns: repeat(5, 1fr);
          grid-auto-rows: 44mm; gap: 3mm;
        }
        .jeton {
          border: 1.5px dashed #999;
          border-radius: 4px;
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          position: relative; overflow: hidden;
          page-break-inside: avoid;
          gap: 2mm;
        }
        .jeton-icon {
          font-size: 22px;
          line-height: 1;
        }
        .jeton-date {
          font-size: 24px; font-weight: 700; z-index: 1;
        }
        .jeton-cachet {
          position: absolute; bottom: 3mm; right: 3mm;
          width: 16mm; height: 16mm; opacity: 0.85;
        }
        .jeton-cachet img { width: 100%; height: 100%; object-fit: contain; }
      </style>
    </head>
    <body>
      ${pagesHtml}
      <script>
        window.onload = () => { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

  const handleFilterChange = (key, value) => setFilters(prev => ({
    ...prev,
    [key]: value,
    ...(key !== 'skip' ? { skip: 0 } : {}),
  }));

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
    fetchScheduleMap();
    fetchKpi(); 
  }, []);


  const DesignPickerModal = ({ onClose, onConfirm }) => {
  const [choice, setChoice] = useState(selectedDesign);
  return (
    <div className="attendance-modal-backdrop">
      <div className="attendance-modal" style={{ maxWidth: 480 }}>
        <div className="modal-header">
          <h3>Choisir le design du jeton</h3>
          <button onClick={onClose} className="modal-close-btn"><X /></button>
        </div>
        <div className="modal-content">
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '8px 0'
          }}>
            {JETON_DESIGNS.map(d => (
              <button
                key={d.id}
                onClick={() => setChoice(d)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                  border: choice.id === d.id ? `2px solid ${d.color}` : '1px solid #ddd',
                  background: choice.id === d.id ? `${d.color}11` : '#fff',
                }}
              >
                <span style={{ fontSize: 26 }}>{d.emoji}</span>
                <span style={{ fontSize: 11, color: '#555' }}>{d.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onClose} className="btn btn-gray">Annuler</button>
          <button onClick={() => onConfirm(choice)} className="btn btn-blue">Générer</button>
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
            <h1>Liste des presences </h1>
            <p>Suivi des pointages des employés avec filtrage avancé</p>
          </div>
          <div className="header-actions">
            <button onClick={fetchAttendance} disabled={loading} className="btn btn-blue">
              <RefreshCw className={`icon ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button onClick={() => exportToExcel()} className="btn btn-green">
                <Download className="icon" />
              Exporter
            </button>
            <button onClick={() => setShowDesignModal(true)} className="btn btn-gray">
              <FileDown className="icon" />
              Générer jetons cantine
            </button>
          </div>
        </header>

        {error && (
          <div className="error-alert">
            <AlertCircle className="icon" />
            <p>{error}</p>
          </div>
        )}

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
                <div className="filter-group">
                <button
                  type="button"
                  onClick={() => setEarlyDepartureFilter(prev => !prev)}
                  className={`filter-mode-btn ${earlyDepartureFilter ? 'active' : ''}`}
                >
                  <Clock className="icon" />
                  Départ anticipé
                </button>
              </div>
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
                <label className="filter-label">Classification</label>
                <select
                  value={classificationFilter}
                  onChange={(e) => setClassificationFilter(e.target.value)}
                  className="filter-input"
                >
                  <option value="">-- Toutes les classifications --</option>
                  {availableClassifications.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
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
                        .filter(ip => !selectedGroup || clockers.find(c => c.ip_address === ip && c.group_name === selectedGroup))
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
              Affichage de {filteredAttendanceData.length} sur {totalRecords} enregistrements
              {/* ✅ Show employee map load status */}
              {loadingEmployees && <span style={{ color: '#9e9e9e', marginLeft: 8, fontSize: 12 }}>• Chargement des noms…</span>}
            </p>
          </div>

         <div className="table-scroll" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table className="attendance-table">
            <thead>
              <tr>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>Utilisateur</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, color: '#111' }}>Date</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, color: '#10b981' }}>Arrivée</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, color: '#ef4444' }}>Départ</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2, color: '#7c3aed' }}>Heure sup.</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>Pointages</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>Clocker</th>
                <th style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>Section</th>
              </tr>
            </thead>
              <tbody>
                {filteredAttendanceData.map((record, index) => {
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
                              <div style={{ fontSize: 11, color: '#9e9e9e' }}>#{formatEmployeeId(record.user_id)}</div>
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
                      <td style={{ fontWeight: 600, fontSize: 13, color: computeOvertimeMinutes(record) > 0 ? '#7c3aed' : '#9e9e9e' }}>
                        {fmtOvertimeMinutes(computeOvertimeMinutes(record))}
                      </td>
                      <td style={{ fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                        {record.punch_count || 1}
                      </td>
                      <td className="ip-cell">{getClockerName(record.device_ip)}</td>
                      <td style={{ fontSize: 13, color: '#374151' }}>
                        {getEmployeeSection(record.user_id) || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {!loading && filteredAttendanceData.length === 0 && (
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
                ({filters.skip + 1} - {Math.min(filters.skip + filteredAttendanceData.length, totalRecords)} sur {totalRecords})
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
                disabled={filteredAttendanceData.length < filters.limit} className="pagination-btn">
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
          <p>Système de pointage RH</p>
        </footer>
      </div>

  {showDesignModal && (
    <DesignPickerModal
      onClose={() => setShowDesignModal(false)}
      onConfirm={(design) => {
        setSelectedDesign(design);
        setShowDesignModal(false);
        generateJetonsCantine(design);
      }}
    />
  )}
    </div>
  );
};

export default HRAttendanceDashboard;
