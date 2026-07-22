import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Plus, Trash2, FileDown, X, Search, Download } from 'lucide-react';
import hrClient from '../../api/hrClient';
import cachet from '../../assets/cachet.png';

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

const JETONS_PAR_PAGE = 50;

const CantineDashboard = () => {
  const [cantineList, setCantineList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDesignModal, setShowDesignModal] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState(JETON_DESIGNS[0]);
  const [siteFilter, setSiteFilter] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const isReadOnly = !!selectedDate;

  const availableSites = useMemo(() => {
  const set = new Set((cantineList?.items || []).map(i => i.factory_name).filter(Boolean));
  return Array.from(set).sort();
}, [cantineList]);

const fetchList = useCallback(async (date) => {
  setLoading(true);
  try {
    if (date) {
      const res = await hrClient.get('employees/cantine-lists/', { params: { date } });
      const list = (res.data.results ?? res.data)[0] || null;
      setCantineList(list);
    } else {
      const res = await hrClient.get('employees/cantine-lists/today/');
      setCantineList(res.data);
    }
  } catch (err) {
    console.error('Erreur chargement liste cantine:', err);
  } finally {
    setLoading(false);
  }
}, []);

useEffect(() => { fetchList(selectedDate); }, [fetchList, selectedDate]);

useEffect(() => { fetchList(selectedDate); }, [fetchList, selectedDate]);

  const filteredItems = useMemo(() => {
    const items = cantineList?.items || [];
    if (!siteFilter) return items;
    return items.filter(i => i.factory_name === siteFilter);
  }, [cantineList, siteFilter]);

  const fetchToday = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrClient.get('employees/cantine-lists/today/');
      setCantineList(res.data);
    } catch (err) {
      console.error('Erreur chargement liste cantine:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchToday(); }, [fetchToday]);

  useEffect(() => {
    if (search.trim().length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await hrClient.get('employees/transport-search/', { params: { search } });
        setSearchResults(res.data);
      } catch (err) {
        console.error('Erreur recherche employé:', err);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const alreadyInList = useMemo(
    () => new Set((cantineList?.items || []).map(i => i.employee)),
    [cantineList]
  );

  const addEmployee = async (emp) => {
    if (!cantineList || isReadOnly) return;
    try {
      const res = await hrClient.post(`employees/cantine-lists/${cantineList.id}/add-item/`, { employee_id: emp.id });
      setCantineList(prev => ({
        ...prev,
        items: [...prev.items, res.data],
        total: prev.total + 1,
      }));
      setSearch('');
      setSearchResults([]);
    } catch (err) {
      alert(err.response?.data?.detail || "Erreur lors de l'ajout.");
    }
  };

  const removeEmployee = async (itemId) => {
    if (!cantineList || isReadOnly) return;
    try {
      await hrClient.delete(`employees/cantine-lists/${cantineList.id}/items/${itemId}/`);
      setCantineList(prev => ({
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
        total: prev.total - 1,
      }));
    } catch (err) {
      alert("Erreur lors de la suppression.");
    }
  };

  const exportCantineCsv = () => {
  const items = filteredItems;
  if (items.length === 0) { alert('Aucune donnée à exporter.'); return; }

  const fmtTime = (dt) => dt ? new Date(dt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';

  const headers = ['Matricule', 'Nom', 'Prénom', 'Site', 'Heure d\'arrivée'];
  const csvData = items.map(i => [
    i.matricule || '—',
    i.nom || '—',
    i.prenom || '—',
    i.factory_name || '—',
    fmtTime(i.arrival),
  ]);
  const csv = [headers, ...csvData].map(row => row.join(';')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Cantine_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

  const generateJetons = (design) => {
    const count = cantineList?.items?.length || 0;
    if (count === 0) { alert('Aucun employé dans la liste cantine.'); return; }

    const todayLabel = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const cachetUrl = new URL(cachet, window.location.origin).href;

    const jetonHtml = `
      <div class="jeton" style="border-color: ${design.color}66;">
        <div class="jeton-icon" style="color: ${design.color};">${design.emoji}</div>
        <div class="jeton-cachet"><img src="${cachetUrl}" alt="cachet pbi" /></div>
        <div class="jeton-date" style="color: ${design.color};">${todayLabel}</div>
      </div>
    `;

    const totalPages = Math.ceil(count / JETONS_PAR_PAGE);
    const pagesHtml = Array.from({ length: totalPages }, (_, pageIndex) => {
      const remaining = count - pageIndex * JETONS_PAR_PAGE;
      const jetonsSurCettePage = Math.min(JETONS_PAR_PAGE, remaining);
      const jetons = Array.from({ length: jetonsSurCettePage }, () => jetonHtml).join('');
      return `<div class="page"><div class="jetons-grid">${jetons}</div></div>`;
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
          .jetons-grid {
            display: grid; grid-template-columns: repeat(5, 1fr);
            grid-auto-rows: 26mm; gap: 2mm;
          }
          .jeton {
            border: 1.5px dashed #999;
            border-radius: 4px;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            position: relative; overflow: hidden;
            page-break-inside: avoid;
            gap: 1mm;
          }
          .jeton-icon { font-size: 22px; line-height: 1; }
          .jeton-date { font-size: 18px; font-weight: 700; z-index: 1; }
          .jeton-cachet { position: absolute; bottom: 2mm; right: 2mm; width: 11mm; height: 11mm; opacity: 0.85; }
          .jeton-cachet img { width: 100%; height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        ${pagesHtml}
        <script>window.onload = () => { window.print(); };</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '8px 0' }}>
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
        <header className="attendance-header">
          <div>
            <h1>Cantine</h1>
            <p>Personnel présent aujourd'hui (hors HC) — liste modifiable</p>
          </div>
          <div className="header-actions">
            <button onClick={exportCantineCsv} className="btn btn-green">
              <Download className="icon" />
              Exporter CSV
            </button>
            <button onClick={() => setShowDesignModal(true)} className="btn btn-gray">
              <FileDown className="icon" />
              Générer jetons
            </button>
          </div>
        </header>

<section className="filters-section">
  <div className="filters-content">

    {/* Bloc 1 : Consulter une date */}
    <div className="filter-group">
      <label className="filter-label">Consulter une date</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="date"
          value={selectedDate || new Date().toISOString().split('T')[0]}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => {
            const today = new Date().toISOString().split('T')[0];
            setSelectedDate(e.target.value === today ? null : e.target.value);
          }}
          className="filter-input"
        />
        {isReadOnly && (
          <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 600 }}>
            Lecture seule — historique
          </span>
        )}
        {isReadOnly && (
          <button onClick={() => setSelectedDate(null)} className="btn btn-gray">
            Revenir à aujourd'hui
          </button>
        )}
      </div>
    </div>

    {/* Bloc 2 : Ajouter un employé (uniquement si pas en lecture seule) */}
    {!isReadOnly && (
      <div className="filter-group" style={{ position: 'relative' }}>
        <label className="filter-label">Ajouter un employé</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Search className="icon" size={16} />
          <input
            type="text"
            placeholder="Rechercher par nom ou matricule…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="filter-input"
          />
        </div>

        {searchResults.length > 0 && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
            background: '#fff', border: '1px solid #ddd', borderRadius: 8,
            maxHeight: 240, overflowY: 'auto', marginTop: 4,
          }}>
            {searchResults.map(emp => {
              const already = alreadyInList.has(emp.id);
              return (
                <div
                  key={emp.id}
                  onClick={() => !already && addEmployee(emp)}
                  style={{
                    padding: '8px 12px', cursor: already ? 'not-allowed' : 'pointer',
                    opacity: already ? 0.5 : 1,
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <span>{emp.full_name} <small style={{ color: '#999' }}>#{emp.employee_id}</small></span>
                  {already ? <span style={{ fontSize: 11, color: '#999' }}>Déjà ajouté</span> : <Plus size={16} />}
                </div>
              );
            })}
          </div>
        )}
      </div>
    )}

    {/* Bloc 3 : Filtre par site — toujours visible, même en lecture seule */}
    <div className="filter-group">
      <label className="filter-label">Filtrer par site</label>
      <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} className="filter-input">
        <option value="">-- Tous les sites --</option>
        {availableSites.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>

  </div>
</section>

        <section className="attendance-table-section">
          <div className="table-header">
            <h2>Liste du jour</h2>
            <p>Total : <strong>{filteredItems.length}</strong> employé(s)</p>          </div>

          <div className="table-scroll" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="attendance-table">
              <thead>
  <tr>
    <th>Matricule</th>
    <th>Nom</th>
    <th>Prénom</th>
    <th>Site</th>
    <th>Arrivée</th>
    {!isReadOnly && <th>Actions</th>}
  </tr>
</thead>
<tbody>
  {filteredItems.map(item => (
    <tr key={item.id}>
      <td>{item.matricule || '—'}</td>
      <td>{item.nom || '—'}</td>
      <td>{item.prenom || '—'}</td>
      <td>{item.factory_name || '—'}</td>
      <td>
        {item.arrival ? new Date(item.arrival).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—'}
      </td>
      {!isReadOnly && (
        <td>
          <button onClick={() => removeEmployee(item.id)} className="btn btn-view" style={{ color: '#ef4444' }}>
            <Trash2 className="icon" size={14} />
            Retirer
          </button>
        </td>
      )}
    </tr>
  ))}
</tbody>
            </table>

            {!loading && (filteredItems?.items || []).length === 0 && (
              <div className="no-data">
                <Users className="icon large" />
                <p className="no-data-title">Aucun employé dans la liste</p>
                <p className="no-data-subtitle">Ajoutez des employés via la recherche ci-dessus</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {showDesignModal && (
        <DesignPickerModal
          onClose={() => setShowDesignModal(false)}
          onConfirm={(design) => {
            setSelectedDesign(design);
            setShowDesignModal(false);
            generateJetons(design);
          }}
        />
      )}
    </div>
  );
};

export default CantineDashboard;