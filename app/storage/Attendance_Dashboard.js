import React, { useState, useEffect, useCallback } from 'react';
import './AttendanceDashboard.css';
import {
  Clock, Users, Download, Filter,
  BarChart3, RefreshCw, Eye, X, AlertCircle
} from 'lucide-react';

const HRAttendanceDashboard = () => {
  // Set default date_from to 7 days ago, date_to today
  const todayStr = new Date().toISOString().split('T')[0];
  const sevenDaysAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [attendanceData, setAttendanceData] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    user_id: '',
    date_from: sevenDaysAgoStr,
    date_to: todayStr,
    device_ip: '',
    period: '',
    skip: 0,
    limit: 100,
  });
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const API_BASE = 'http://192.168.8.247:8000/attendance/';

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();

      // Always send date_from and date_to to avoid 422
      const dateFrom = filters.date_from && filters.date_from.trim() !== '' ? filters.date_from.trim() : sevenDaysAgoStr;
      const dateTo = filters.date_to && filters.date_to.trim() !== '' ? filters.date_to.trim() : todayStr;

      params.append('date_from', dateFrom);
      params.append('date_to', dateTo);

      // Convert user_id to number if valid before appending
      if (filters.user_id) {
        const userIdNum = Number(filters.user_id);
        if (!isNaN(userIdNum) && userIdNum > 0) {
          params.append('user_id', userIdNum);
        }
      }

      if (filters.device_ip) params.append('device_ip', filters.device_ip);
      if (filters.period) params.append('period', filters.period);

      params.append('skip', filters.skip || 0);
      params.append('limit', filters.limit || 100);

      console.log('Fetching with params:', params.toString());

      const response = await fetch(`${API_BASE}?${params.toString()}`);

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      const cleanData = Array.isArray(data) ? data : [];

      setAttendanceData(cleanData);

      const uniqueUsers = [...new Set(cleanData.map(r => r.user_id))].length;

      setStats({
        total_records: cleanData.length,
        unique_users: uniqueUsers,
        present_count: cleanData.length,
        absent_count: 0, // Calculate if you have a list of users elsewhere
      });
    } catch (err) {
      setError(`Erreur de récupération : ${err.message}`);
      setAttendanceData([]);
    } finally {
      setLoading(false);
    }
  }, [filters, sevenDaysAgoStr, todayStr]);

  const exportToExcel = () => {
    if (attendanceData.length === 0) {
      alert('Aucune donnée à exporter.');
      return;
    }

    const csv = [
      ['User ID', 'Timestamp', 'Date', 'Device IP'],
      ...attendanceData.map(r => [
        r.user_id,
        r.timestamp,
        r.date,
        r.device_ip,
      ]),
    ].map(row => row.join(',')).join('\n');

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
      device_ip: '',
      period: '',
      skip: 0,
      limit: 100,
    });
  };

  const formatDateTime = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleString('fr-FR');
  };

  const formatDate = (str) => {
    if (!str) return '—';
    return new Date(str).toLocaleDateString('fr-FR');
  };

  const viewRecord = (rec) => {
    setSelectedRecord(rec);
    setShowModal(true);
  };

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const RecordModal = ({ record, onClose }) => {
    if (!record) return null;
    return (
      <div className="attendance-modal-backdrop">
        <div className="attendance-modal">
          <div className="modal-header">
            <h3>Détails du pointage</h3>
            <button onClick={onClose}><X /></button>
          </div>
          <div className="modal-content">
            <p><strong>ID Utilisateur:</strong> {record.user_id}</p>
            <p><strong>Date:</strong> {formatDate(record.date)}</p>
            <p><strong>Horodatage:</strong> {formatDateTime(record.timestamp)}</p>
            <p><strong>Adresse IP:</strong> {record.device_ip}</p>
          </div>
          <div className="modal-actions">
            <button onClick={onClose}>Fermer</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="attendance-dashboard">
      <div className="container">
        <header className="attendance-header">
          <div>
            <h1>Tableau de bord RH</h1>
            <p>Suivi des pointages des employés</p>
          </div>
          <div>
            <button className="btn btn-blue" onClick={fetchAttendance} disabled={loading}>
              <RefreshCw className={`icon ${loading ? 'animate-spin' : ''}`} />
              Actualiser
            </button>
            <button className="btn btn-green" onClick={exportToExcel}>
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

        <section className="stats-grid">
          <div className="stats-card">
            <Users className="icon" />
            <p className="label">Total</p>
            <p className="value">{stats.total_records || 0}</p>
          </div>
          <div className="stats-card">
            <Clock className="icon" />
            <p className="label">Pointages</p>
            <p className="value">{stats.present_count || 0}</p>
          </div>
          <div className="stats-card">
            <BarChart3 className="icon" />
            <p className="label">Aujourd’hui</p>
            <p className="value">
              {attendanceData.filter(r => new Date(r.date).toDateString() === new Date().toDateString()).length}
            </p>
          </div>
          <div className="stats-card">
            <Users className="icon" />
            <p className="label">Utilisateurs uniques</p>
            <p className="value">{stats.unique_users || 0}</p>
          </div>
        </section>

        <section className="filters-section">
          <h2><Filter className="icon" /> Filtres</h2>
          <div className="filters-grid">
            <input
              type="number"
              placeholder="ID Utilisateur"
              value={filters.user_id}
              onChange={(e) => {
                const val = e.target.value;
                // Allow only numbers or empty string
                if (val === '' || /^\d*$/.test(val)) {
                  handleFilterChange('user_id', val);
                }
              }}
            />
            <input
              type="date"
              value={filters.date_from}
              onChange={(e) => handleFilterChange('date_from', e.target.value)}
            />
            <input
              type="date"
              value={filters.date_to}
              onChange={(e) => handleFilterChange('date_to', e.target.value)}
            />
            <input
              type="text"
              placeholder="Adresse IP"
              value={filters.device_ip}
              onChange={(e) => handleFilterChange('device_ip', e.target.value)}
            />
            <select value={filters.period} onChange={(e) => handleFilterChange('period', e.target.value)}>
              <option value="">-- Période --</option>
              <option value="today">Aujourd'hui</option>
              <option value="yesterday">Hier</option>
              <option value="this_week">Cette semaine</option>
              <option value="last_week">Semaine dernière</option>
            </select>
            <button className="btn btn-gray" onClick={clearFilters}>Réinitialiser</button>
          </div>
        </section>

        <section className="attendance-table-container">
          <div className="table-header">
            <h2>Enregistrements</h2>
            <p>Affichage de {attendanceData.length} pointages</p>
          </div>

          <div className="table-scroll">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Utilisateur</th>
                  <th>Horodatage</th>
                  <th>Adresse IP</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendanceData.map((r, i) => (
                  <tr key={`${r.user_id}-${r.timestamp}-${i}`}>
                    <td>{r.user_id}</td>
                    <td>{formatDateTime(r.timestamp)}</td>
                    <td>{r.device_ip}</td>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      <button onClick={() => viewRecord(r)} className="btn btn-blue"><Eye /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && attendanceData.length === 0 && (
              <div className="no-data">
                <Users className="icon" />
                <p>Aucun pointage trouvé</p>
              </div>
            )}
          </div>
        </section>

        <section className="pagination-section">
          <label>Résultats / page:</label>
          <select
            value={filters.limit}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value))}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
            <option value={500}>500</option>
          </select>

          <div className="pagination-controls">
            <button
              onClick={() => handleFilterChange('skip', Math.max(0, filters.skip - filters.limit))}
              disabled={filters.skip === 0}
            >
              Précédent
            </button>
            <span>
              {filters.skip + 1} - {filters.skip + attendanceData.length}
            </span>
            <button
              onClick={() => handleFilterChange('skip', filters.skip + filters.limit)}
              disabled={attendanceData.length < filters.limit}
            >
              Suivant
            </button>
          </div>
        </section>

        <footer className="footer-info">
          Dernière mise à jour : {new Date().toLocaleString('fr-FR')}
        </footer>
      </div>

      {showModal && (
        <RecordModal record={selectedRecord} onClose={() => {
          setSelectedRecord(null);
          setShowModal(false);
        }} />
      )}
    </div>
  );
};

export default HRAttendanceDashboard;
