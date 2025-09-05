import React, { useState, useEffect, useCallback } from 'react';
import './AttendanceDashboard.css';
import {
  Clock, Users, Download, Filter, Calendar, Timer,
  BarChart3, RefreshCw, Eye, X, AlertCircle, TrendingUp,
  ChevronLeft, ChevronRight, Search, FileDown
} from 'lucide-react';

const HRAttendanceDashboard = () => {
  // Set default date_from to 7 days ago, date_to today
  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [totalRecords, setTotalRecords] = useState(0);
  const [availableIPs, setAvailableIPs] = useState([]); // New state for available IP addresses
  const [loadingIPs, setLoadingIPs] = useState(false); // Loading state for IPs

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
    limit: 100,
  });

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterMode, setFilterMode] = useState('range'); // 'range', 'specific', 'period'

  const API_BASE = 'http://192.168.8.247:8000/attendance/';

  // Fetch available IP addresses
  const fetchAvailableIPs = useCallback(async () => {
    setLoadingIPs(true);
    try {
      const response = await fetch(`${API_BASE}available-ips`);
      if (response.ok) {
        const ips = await response.json();
        setAvailableIPs(ips);
      } else {
        // Fallback: extract IPs from current data or use a basic query
        console.warn('Available IPs endpoint not found, extracting from data');
        await extractIPsFromData();
      }
    } catch (err) {
      console.error('Error fetching available IPs:', err);
      // Fallback to extracting IPs from current data
      await extractIPsFromData();
    } finally {
      setLoadingIPs(false);
    }
  }, []);

  // Fallback method to extract IPs from attendance data
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
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      // Handle different filter modes
      if (filterMode === 'period' && filters.period) {
        params.append('period', filters.period);
      } else if (filterMode === 'specific' && filters.target_date) {
        params.append('target_date', filters.target_date);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      } else {
        // Range mode (default)
        const dateFrom = filters.date_from && filters.date_from.trim() !== '' ? filters.date_from.trim() : sevenDaysAgoStr;
        const dateTo = filters.date_to && filters.date_to.trim() !== '' ? filters.date_to.trim() : todayStr;
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);

        // Add time filters for range mode
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      }

      // Convert user_id to number if valid before appending
      if (filters.user_id) {
        const userIdNum = Number(filters.user_id);
        if (!isNaN(userIdNum) && userIdNum > 0) {
          params.append('user_id', userIdNum);
        }
      }

      if (filters.device_ip) params.append('device_ip', filters.device_ip);

      params.append('skip', filters.skip || 0);
      params.append('limit', filters.limit || 100);

      console.log('Fetching with params:', params.toString());

      const response = await fetch(`${API_BASE}?${params.toString()}`);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const cleanData = Array.isArray(data) ? data : [];

      // Get total count from headers
      const totalCount = response.headers.get('X-Total-Count');
      setTotalRecords(totalCount ? parseInt(totalCount) : cleanData.length);

      setAttendanceData(cleanData);

      // Fetch stats separately for better performance
      await fetchStats();

    } catch (err) {
      setError(`Erreur de récupération : ${err.message}`);
      setAttendanceData([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [filters, filterMode, sevenDaysAgoStr, todayStr]);

  const fetchStats = async () => {
    try {
      const params = new URLSearchParams();

      // Apply same filters to stats
      if (filterMode === 'period' && filters.period) {
        params.append('period', filters.period);
      } else if (filterMode === 'specific' && filters.target_date) {
        params.append('target_date', filters.target_date);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      } else {
        const dateFrom = filters.date_from || sevenDaysAgoStr;
        const dateTo = filters.date_to || todayStr;
        params.append('date_from', dateFrom);
        params.append('date_to', dateTo);
        if (filters.time_from) params.append('time_from', filters.time_from);
        if (filters.time_to) params.append('time_to', filters.time_to);
      }

      if (filters.user_id) {
        const userIdNum = Number(filters.user_id);
        if (!isNaN(userIdNum) && userIdNum > 0) {
          params.append('user_id', userIdNum);
        }
      }
      if (filters.device_ip) params.append('device_ip', filters.device_ip);

      const response = await fetch(`${API_BASE}stats?${params.toString()}`);
      if (response.ok) {
        const statsData = await response.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const exportToExcel = () => {
    if (attendanceData.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    const headers = ['User ID', 'Date', 'Time']; //['User ID', 'Timestamp', 'Date', 'Time', 'Device IP']
    const csvData = attendanceData.map(r => [
      r.user_id,
      //r.timestamp,
      r.date || r.attendance_date,
      new Date(r.timestamp).toLocaleTimeString('fr-FR'),
      //r.device_ip,
    ]);

    const csv = [headers, ...csvData]
      .map(row => row.join(';'))
      .join('\n');

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

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, skip: 0 }));
  };

  const clearFilters = () => {
    setFilters({
      user_id: '',
      date_from: sevenDaysAgoStr,
      date_to: todayStr,
      time_from: '',
      time_to: '',
      target_date: '',
      device_ip: '',
      period: '',
      skip: 0,
      limit: 100,
    });
    setFilterMode('range');
  };

  const handleQuickTimeFilter = (timeRange) => {
    const times = {
      'morning': { from: '06:00', to: '12:00' },
      'afternoon': { from: '12:00', to: '18:00' },
      'evening': { from: '18:00', to: '23:59' },
      'business': { from: '08:00', to: '17:00' },
      'night': { from: '22:00', to: '06:00' }
    };

    if (times[timeRange]) {
      handleFilterChange('time_from', times[timeRange].from);
      handleFilterChange('time_to', times[timeRange].to);
    }
  };

  const formatDateTime = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleString('fr-FR');
  };

  const formatDate = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('fr-FR');
  };

  const formatTime = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleTimeString('fr-FR');
  };

  const viewRecord = (rec) => {
    setSelectedRecord(rec);
    setShowModal(true);
  };

  const getCurrentPage = () => Math.floor(filters.skip / filters.limit) + 1;
  const getTotalPages = () => Math.ceil(totalRecords / filters.limit);

  const goToPage = (page) => {
    const newSkip = (page - 1) * filters.limit;
    handleFilterChange('skip', newSkip);
  };

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  useEffect(() => {
    fetchAvailableIPs();
  }, []); // Fetch IPs when component mounts

  const RecordModal = ({ record, onClose }) => {
    if (!record) return null;
    return (
      <div className="attendance-modal-backdrop">
        <div className="attendance-modal">
          <div className="modal-header">
            <h3>Détails du pointage</h3>
            <button onClick={onClose} className="modal-close-btn">
              <X />
            </button>
          </div>
          <div className="modal-content">
            <div className="modal-info-grid">
              <div>
                <p className="modal-label">ID employé(e)</p>
                <p className="modal-value">{record.user_id}</p>
              </div>
              <div>
                <p className="modal-label">Adresse IP du Clocker</p>
                <p className="modal-value">{record.device_ip}</p>
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
            <button onClick={onClose} className="btn btn-blue">
              Fermer
            </button>
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
            <button
              onClick={fetchAttendance}
              disabled={loading}
              className="btn btn-blue"
            >
              <RefreshCw className={`icon ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button
              onClick={exportToExcel}
              className="btn btn-green"
            >
              <Download className="icon" />
              Exporter
            </button>
          </div>
        </header>

        {/* Error Alert */}
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
              <div className="stats-icon blue">
                <BarChart3 className="icon" />
              </div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Pointages</p>
                <p className="stats-value">{stats.total_records || 0}</p>
              </div>
              <div className="stats-icon green">
                <Clock className="icon" />
              </div>
            </div>
          </div>

          <div className="stats-card">
            <div className="stats-content">
              <div>
                <p className="stats-label">Utilisateurs uniques</p>
                <p className="stats-value">{stats.unique_users || 0}</p>
              </div>
              <div className="stats-icon purple">
                <Users className="icon" />
              </div>
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
              <div className="stats-icon orange">
                <TrendingUp className="icon" />
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced Filters Section */}
        <section className="filters-section">
          <div className="filters-header">
            <h2>
              <Filter className="icon" />
              Filtres avancés
            </h2>
          </div>

          <div className="filters-content">
            {/* Filter Mode Selection */}
            <div className="filter-mode-section">
              <label className="filter-mode-label">Mode de filtrage</label>
              <div className="filter-mode-buttons">
                <button
                  onClick={() => setFilterMode('range')}
                  className={`filter-mode-btn ${filterMode === 'range' ? 'active' : ''}`}
                >
                  <Calendar className="icon" />
                  Plage de dates
                </button>
                <button
                  onClick={() => setFilterMode('specific')}
                  className={`filter-mode-btn ${filterMode === 'specific' ? 'active' : ''}`}
                >
                  <Timer className="icon" />
                  Date spécifique
                </button>
                <button
                  onClick={() => setFilterMode('period')}
                  className={`filter-mode-btn ${filterMode === 'period' ? 'active' : ''}`}
                >
                  <Clock className="icon" />
                  Période prédéfinie
                </button>
              </div>
            </div>

            {/* Dynamic Filter Inputs */}
            <div className="filters-grid">
              {/* Common filters */}
              <div className="filter-group">
                <label className="filter-label">ID Employé(e)</label>
                <input
                  type="number"
                  placeholder="ID Utilisateur"
                  value={filters.user_id}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*$/.test(val)) {
                      handleFilterChange('user_id', val);
                    }
                  }}
                  className="filter-input"
                />
              </div>

              <div className="filter-group">
                <label className="filter-label">
                  Adresse IP du Clocker
                  {loadingIPs && <span className="loading-text"> (Chargement...)</span>}
                </label>
                <div className="ip-filter-container">
                  {availableIPs.length > 0 ? (
                    <select
                      value={filters.device_ip}
                      onChange={(e) => handleFilterChange('device_ip', e.target.value)}
                      className="filter-input"
                      disabled={loadingIPs}
                    >
                      <option value="">-- Toutes les adresses IP --</option>
                      {availableIPs.map((ip) => (
                        <option key={ip} value={ip}>
                          {ip}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      placeholder="Adresse IP (ou attendez le chargement...)"
                      value={filters.device_ip}
                      onChange={(e) => handleFilterChange('device_ip', e.target.value)}
                      className="filter-input"
                      disabled={loadingIPs}
                    />
                  )}
                  <button
                    onClick={fetchAvailableIPs}
                    className="refresh-ip-btn"
                    disabled={loadingIPs}
                    title="Actualiser la liste des IP"
                  >
                    <RefreshCw className={`icon small ${loadingIPs ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Mode-specific filters */}
              {filterMode === 'range' && (
                <>
                  <div className="filter-group">
                    <label className="filter-label">Date de début</label>
                    <input
                      type="date"
                      value={filters.date_from}
                      onChange={(e) => handleFilterChange('date_from', e.target.value)}
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Date de fin</label>
                    <input
                      type="date"
                      value={filters.date_to}
                      onChange={(e) => handleFilterChange('date_to', e.target.value)}
                      className="filter-input"
                    />
                  </div>
                </>
              )}

              {filterMode === 'specific' && (
                <div className="filter-group">
                  <label className="filter-label">Date cible</label>
                  <input
                    type="date"
                    value={filters.target_date}
                    onChange={(e) => handleFilterChange('target_date', e.target.value)}
                    className="filter-input"
                  />
                </div>
              )}

              {filterMode === 'period' && (
                <div className="filter-group">
                  <label className="filter-label">Période</label>
                  <select
                    value={filters.period}
                    onChange={(e) => handleFilterChange('period', e.target.value)}
                    className="filter-input"
                  >
                    <option value="">-- Sélectionner --</option>
                    <option value="today">Aujourd'hui</option>
                    <option value="yesterday">Hier</option>
                    <option value="this_week">Cette semaine</option>
                    <option value="last_week">Semaine dernière</option>
                  </select>
                </div>
              )}
            </div>

            {/* Time Filters (for range and specific modes) */}
            {(filterMode === 'range' || filterMode === 'specific') && (
              <>
                <div className="time-filters-grid">
                  <div className="filter-group">
                    <label className="filter-label">Heure de début</label>
                    <input
                      type="time"
                      value={filters.time_from}
                      onChange={(e) => handleFilterChange('time_from', e.target.value)}
                      className="filter-input"
                    />
                  </div>
                  <div className="filter-group">
                    <label className="filter-label">Heure de fin</label>
                    <input
                      type="time"
                      value={filters.time_to}
                      onChange={(e) => handleFilterChange('time_to', e.target.value)}
                      className="filter-input"
                    />
                  </div>
                </div>

                {/* Quick Time Filters */}
                <div className="quick-time-filters">
                  <label className="quick-time-label">Créneaux rapides</label>
                  <div className="quick-time-buttons">
                    <button
                      onClick={() => handleQuickTimeFilter('morning')}
                      className="quick-time-btn morning"
                    >
                      Matin (6h-12h)
                    </button>
                    <button
                      onClick={() => handleQuickTimeFilter('afternoon')}
                      className="quick-time-btn afternoon"
                    >
                      Après-midi (12h-18h)
                    </button>
                    <button
                      onClick={() => handleQuickTimeFilter('evening')}
                      className="quick-time-btn evening"
                    >
                      Soir (18h-24h)
                    </button>
                    <button
                      onClick={() => handleQuickTimeFilter('business')}
                      className="quick-time-btn business"
                    >
                      Horaires bureau (8h-17h)
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Action Buttons */}
            <div className="filter-actions">
              <button
                onClick={fetchAttendance}
                className="btn btn-blue"
              >
                <Search className="icon" />
                Rechercher
              </button>
              <button
                onClick={clearFilters}
                className="btn btn-gray"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </section>

        {/* Data Table */}
        <section className="attendance-table-section">
          <div className="table-header">
            <h2>Enregistrements de pointage</h2>
            <p>
              Affichage de {attendanceData.length} sur {totalRecords} enregistrements
            </p>
          </div>

          <div className="table-scroll">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Adresse IP</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((record, index) => (
                  <tr key={`${record.user_id}-${record.timestamp}-${index}`}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          <Users className="icon" />
                        </div>
                        <div>
                          <div className="user-id">ID: {record.user_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="date-cell">
                      {formatDate(record.date || record.attendance_date)}
                    </td>
                    <td className="time-cell">
                      {formatTime(record.timestamp)}
                    </td>
                    <td className="ip-cell">
                      {record.device_ip}
                    </td>
                    <td>
                      <button
                        onClick={() => viewRecord(record)}
                        className="btn btn-view"
                      >
                        <Eye className="icon" />
                        Voir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && attendanceData.length === 0 && (
              <div className="no-data">
                <Users className="icon large" />
                <p className="no-data-title">Aucun pointage trouvé</p>
                <p className="no-data-subtitle">
                  Essayez d'ajuster vos filtres de recherche
                </p>
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

        {/* Enhanced Pagination */}
        <section className="pagination-section">
          <div className="pagination-content">
            <div className="pagination-info">
              <label>Résultats par page:</label>
              <select
                value={filters.limit}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
                className="pagination-select"
              >
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            <div className="pagination-stats">
              <span>Page {getCurrentPage()} sur {getTotalPages()}</span>
              <span className="pagination-range">
                ({filters.skip + 1} - {Math.min(filters.skip + attendanceData.length, totalRecords)} sur {totalRecords})
              </span>
            </div>

            <div className="pagination-controls">
              <button
                onClick={() => handleFilterChange('skip', 0)}
                disabled={filters.skip === 0}
                className="pagination-btn"
              >
                Premier
              </button>
              <button
                onClick={() => handleFilterChange('skip', Math.max(0, filters.skip - filters.limit))}
                disabled={filters.skip === 0}
                className="pagination-btn"
              >
                <ChevronLeft className="icon" />
                Précédent
              </button>

              {/* Page Numbers */}
              {(() => {
                const currentPage = getCurrentPage();
                const totalPages = getTotalPages();
                const pages = [];
                const maxPagesToShow = 5;

                let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

                if (endPage - startPage + 1 < maxPagesToShow) {
                  startPage = Math.max(1, endPage - maxPagesToShow + 1);
                }

                for (let i = startPage; i <= endPage; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => goToPage(i)}
                      className={`pagination-btn ${i === currentPage ? 'active' : ''}`}
                    >
                      {i}
                    </button>
                  );
                }
                return pages;
              })()}

              <button
                onClick={() => handleFilterChange('skip', filters.skip + filters.limit)}
                disabled={attendanceData.length < filters.limit}
                className="pagination-btn"
              >
                Suivant
                <ChevronRight className="icon" />
              </button>
              <button
                onClick={() => goToPage(getTotalPages())}
                disabled={getCurrentPage() === getTotalPages()}
                className="pagination-btn"
              >
                Dernier
              </button>
            </div>
          </div>
        </section>

        {/* Summary Information */}
        <section className="summary-section">
          <div className="summary-grid">
            <div className="summary-card">
              <div className="summary-icon blue">
                <Clock className="icon" />
              </div>
              <h3>Filtrage en temps réel</h3>
              <p>Filtrez par heure, date spécifique ou plage de dates</p>
            </div>

            <div className="summary-card">
              <div className="summary-icon green">
                <BarChart3 className="icon" />
              </div>
              <h3>Statistiques détaillées</h3>
              <p>Analyses complètes avec compteurs en temps réel</p>
            </div>

            <div className="summary-card">
              <div className="summary-icon purple">
                <FileDown className="icon" />
              </div>
              <h3>Export flexible</h3>
              <p>Exportez les données filtrées en CSV</p>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="footer-info">
          <div className="footer-content">
            <Clock className="icon" />
            Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
          </div>
          <p>Système de pointage HR - Version 2.0 avec filtrage temporel avancé</p>
        </footer>
      </div>

      {/* Enhanced Modal */}
      {showModal && (
        <RecordModal
          record={selectedRecord}
          onClose={() => {
            setSelectedRecord(null);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
};

export default HRAttendanceDashboard;