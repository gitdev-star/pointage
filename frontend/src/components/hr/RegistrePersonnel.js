import React, { useState, useEffect, useCallback, useRef } from 'react';
import hrClient from '../../api/hrClient';

const STATUS_COLORS = {
  ACTIVE:     { bg: '#e8f5e9', color: '#2e7d32', label: 'Actif' },
  INACTIVE:   { bg: '#f5f5f5', color: '#616161', label: 'Inactif' },
  TERMINATED: { bg: '#fce4ec', color: '#c62828', label: 'Parti' },
  ON_LEAVE:   { bg: '#fff8e1', color: '#f57f17', label: 'En conge' },
};

const CONTRACT_COLORS = {
  CDI:      { bg: '#e3f2fd', color: '#1565c0' },
  CDD:      { bg: '#fff8e1', color: '#f57f17' },
  INTERN:   { bg: '#f3e5f5', color: '#6a1b9a' },
  PART:     { bg: '#e8f5e9', color: '#2e7d32' },
  SEASONAL: { bg: '#fce4ec', color: '#c62828' },
};

function Badge({ value, map }) {
  const s = map[value] || { bg: '#f5f5f5', color: '#616161' };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, padding: '2px 8px',
      borderRadius: 10, whiteSpace: 'nowrap',
    }}>{s.label || value || 'N/A'}</span>
  );
}

const fmt = v => v || 'N/A';
const selSt     = { padding: '7px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, background: '#fff', cursor: 'pointer' };
const thSt      = { padding: '8px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#616161', whiteSpace: 'nowrap', borderBottom: '2px solid #e0e0e0' };
const tdSt      = { padding: '7px 10px', fontSize: 12, color: '#212121', whiteSpace: 'nowrap' };
const pageBtnSt = { padding: '6px 14px', borderRadius: 8, border: '1px solid #e0e0e0', background: '#fff', cursor: 'pointer', fontSize: 12 };

export default function RegistrePersonnel() {
  const [employees, setEmployees]       = useState([]);
  const [total, setTotal]               = useState(0);
  const [loading, setLoading]           = useState(false);
  const [exporting, setExporting]       = useState(false);
  const [factories, setFactories]       = useState([]);
  const [departments, setDepartments]   = useState([]);
  const [page, setPage]                 = useState(1);
  const [filters, setFilters]           = useState({
    status: 'ACTIVE', factory: '', department: '',
    contract_type: '', search: '', sexe: '',
  });
  const PAGE_SIZE   = 50;
  const debounceRef = useRef(null);

  useEffect(() => {
    hrClient.get('employees/factories/?page_size=200').then(r => setFactories(r.data.results ?? r.data)).catch(() => {});
    hrClient.get('employees/departments/?page_size=500').then(r => setDepartments(r.data.results ?? r.data)).catch(() => {});
  }, []);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, page_size: PAGE_SIZE };
      if (filters.status)        params.status        = filters.status;
      if (filters.factory)       params.factory       = filters.factory;
      if (filters.department)    params.department    = filters.department;
      if (filters.contract_type) params.contract_type = filters.contract_type;
      if (filters.search)        params.search        = filters.search;
      if (filters.sexe)          params.sexe          = filters.sexe;
      const r = await hrClient.get('employees/', { params });
      setEmployees(r.data.results ?? r.data);
      setTotal(r.data.count ?? (r.data.results ?? r.data).length);
    } catch {}
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(1); }, 300);
  }, [filters, load]);

  const setFilter = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const exportExcel = async () => {
    setExporting(true);
    try {
      const params = { page_size: 5000 };
      if (filters.status)        params.status        = filters.status;
      if (filters.factory)       params.factory       = filters.factory;
      if (filters.department)    params.department    = filters.department;
      if (filters.contract_type) params.contract_type = filters.contract_type;
      if (filters.search)        params.search        = filters.search;
      if (filters.sexe)          params.sexe          = filters.sexe;
      const r    = await hrClient.get('employees/export/', { params });
      const rows = r.data.results ?? r.data;
      const headers = [
        'N RH', 'Matricule', 'Nom', 'Prenom', 'Sexe', 'Date naissance',
        'CIN', 'Date CIN', 'Lieu CIN', 'CNAPS',
        'Usine', 'Departement', 'Section', 'Poste', 'Contrat',
        'Date embauche', 'Statut', 'Email', 'Telephone', 'Adresse',
        'Nbre enfants', 'Affectation',
      ];
      const csvRows = [
        '\uFEFF' + headers.join(';'),
        ...rows.map(e => [
          e.n_rh, e.employee_id, e.last_name, e.first_name, e.sexe,
          e.birth_date, e.cin, e.cin_date, e.cin_place, e.cnaps,
          e.factory_name, e.department_name, e.section_name || '', e.job_title, e.contract_type,
          e.hire_date, e.status, e.email, e.phone, e.address,
          e.nbre_enfants, e.affectation,
        ].map(v => '"' + (v ?? '').toString().replace(/"/g, '""') + '"').join(';')),
      ];
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'registre_personnel_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch { alert('Export error.'); }
    finally { setExporting(false); }
  };

  const filteredDepts = filters.factory
    ? departments.filter(d => String(d.factory) === String(filters.factory) || String(d.factory_id) === String(filters.factory))
    : departments;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', padding: '20px 16px', maxWidth: 1400, margin: '0 auto' }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #registre-print, #registre-print * { visibility: visible; }
          #registre-print { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          table { font-size: 9px; }
          th, td { padding: 3px 5px !important; }
        }
      `}</style>

      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#212121' }}>Registre du personnel</h1>
          <p style={{ fontSize: 13, color: '#757575', margin: '4px 0 0' }}>
            {loading ? 'Loading...' : total.toLocaleString() + ' employee(s) found'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} disabled={exporting} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #388e3c',
            background: '#e8f5e9', color: '#2e7d32', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>{exporting ? 'Exporting...' : 'Export Excel / CSV'}</button>
          <button onClick={() => window.print()} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid #1565c0',
            background: '#e3f2fd', color: '#1565c0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Print / PDF</button>
        </div>
      </div>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          placeholder="Search name, ID, CIN..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '7px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13 }}
        />
        <select value={filters.status} onChange={e => setFilter('status', e.target.value)} style={selSt}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TERMINATED">Terminated</option>
          <option value="ON_LEAVE">On Leave</option>
        </select>
        <select value={filters.contract_type} onChange={e => setFilter('contract_type', e.target.value)} style={selSt}>
          <option value="">All contracts</option>
          <option value="CDI">CDI</option>
          <option value="CDD">CDD</option>
          <option value="INTERN">Intern</option>
          <option value="PART">Part-time</option>
          <option value="SEASONAL">Seasonal</option>
        </select>
        <select value={filters.sexe} onChange={e => setFilter('sexe', e.target.value)} style={selSt}>
          <option value="">All</option>
          <option value="F">Women</option>
          <option value="M">Men</option>
        </select>
        <select value={filters.factory} onChange={e => { setFilter('factory', e.target.value); setFilter('department', ''); }} style={selSt}>
          <option value="">All factories</option>
          {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <select value={filters.department} onChange={e => setFilter('department', e.target.value)} style={selSt}>
          <option value="">All departments</option>
          {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {Object.values(filters).some(v => v) && (
          <button
            onClick={() => setFilters({ status: 'ACTIVE', factory: '', department: '', contract_type: '', search: '', sexe: '' })}
            style={{ padding: '7px 12px', borderRadius: 8, border: '1px solid #ffcdd2', background: '#fce4ec', color: '#c62828', fontSize: 12, cursor: 'pointer' }}>
            Reset
          </button>
        )}
      </div>

      <div id="registre-print">
        <div style={{ overflowX: 'auto', border: '1px solid #e0e0e0', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                {['#','ID','Last Name','First Name','Sex','Birth Date','CIN','CNAPS',
                  'Factory','Department','Position','Contract','Hire Date','Status'].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px 0', color: '#9e9e9e' }}>Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan={14} style={{ textAlign: 'center', padding: '40px 0', color: '#bdbdbd' }}>No records found.</td></tr>
              ) : employees.map((e, i) => (
                <tr key={e.id} style={{ borderBottom: '1px solid #f5f5f5', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                  <td style={tdSt}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                  <td style={{ ...tdSt, fontFamily: 'monospace', color: '#1565c0' }}>{fmt(e.employee_id)}</td>
                  <td style={{ ...tdSt, fontWeight: 600 }}>{fmt(e.last_name)}</td>
                  <td style={tdSt}>{fmt(e.first_name)}</td>
                  <td style={tdSt}>{fmt(e.sexe)}</td>
                  <td style={tdSt}>{fmt(e.birth_date)}</td>
                  <td style={{ ...tdSt, fontFamily: 'monospace' }}>{fmt(e.cin)}</td>
                  <td style={{ ...tdSt, fontFamily: 'monospace' }}>{fmt(e.cnaps)}</td>
                  <td style={tdSt}>{fmt(e.factory_name)}</td>
                  <td style={tdSt}>{fmt(e.department_name)}</td>
                  <td style={tdSt}>{fmt(e.job_title)}</td>
                  <td style={tdSt}><Badge value={e.contract_type} map={CONTRACT_COLORS} /></td>
                  <td style={tdSt}>{fmt(e.hire_date)}</td>
                  <td style={tdSt}><Badge value={e.status} map={STATUS_COLORS} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="no-print" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 16 }}>
          <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page === 1} style={pageBtnSt}>Prev</button>
          <span style={{ fontSize: 13, color: '#757575' }}>Page {page} / {totalPages} — {total.toLocaleString()} total</span>
          <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page === totalPages} style={pageBtnSt}>Next</button>
        </div>
      )}
    </div>
  );
}
