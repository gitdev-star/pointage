import React, { useState, useEffect, useCallback } from 'react';
import hrClient from '../../api/hrClient';

// ── Match backend MaternityLeave.Status choices exactly ──────────────────────
const STATUS_COLORS = {
  DECLARED:  { bg: '#fff8e1', color: '#f57f17', label: 'Déclarée' },
  ON_LEAVE:  { bg: '#e3f2fd', color: '#1565c0', label: 'En congé' },
  EXTENDED:  { bg: '#f3e5f5', color: '#7b1fa2', label: 'Prolongée' },
  RETURNED:  { bg: '#e8f5e9', color: '#2e7d32', label: 'Reprise' },
  CANCELLED: { bg: '#fce4ec', color: '#c62828', label: 'Annulé' },
};

function Badge({ status }) {
  const s = STATUS_COLORS[status] || { bg: '#f5f5f5', color: '#616161', label: status };
  return (
    <span style={{
      background: s.bg, color: s.color,
      fontSize: 11, fontWeight: 600, padding: '2px 10px',
      borderRadius: 12, letterSpacing: '0.03em',
    }}>{s.label}</span>
  );
}

function AlertBanner({ type = 'info', children }) {
  const colors = {
    warning: { bg: '#fff8e1', color: '#f57f17', border: '#ffe082' },
    danger:  { bg: '#fce4ec', color: '#c62828', border: '#ef9a9a' },
    info:    { bg: '#e3f2fd', color: '#1565c0', border: '#90caf9' },
  };
  const c = colors[type];
  return (
    <div style={{
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 10,
    }}>{children}</div>
  );
}

function ProgressBar({ value, max = 98, color = '#1976d2' }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div style={{ background: '#e0e0e0', borderRadius: 4, height: 5, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, background: color, height: '100%', transition: 'width 0.4s' }} />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
      padding: '12px 16px', textAlign: 'center', flex: 1,
    }}>
      <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9e9e9e', marginTop: 2 }}>{label}</div>
    </div>
  );
}

// ── Employee search — uses correct field names from Employee model ─────────────
function EmpSearch({ value, onChange }) {
  const [q, setQ]                     = React.useState('');
  const [open, setOpen]               = React.useState(false);
  const [results, setResults]         = React.useState([]);
  const [loading, setLoading]         = React.useState(false);
  const [selectedLabel, setSelectedLabel] = React.useState('');
  const debounceRef = React.useRef(null);

  const search = (val) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!val || val.length < 1) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // field is 'sexe' (confirmed from Employee model)
        const r = await hrClient.get(`employees/?sexe=F&search=${encodeURIComponent(val)}&page_size=30&status=ACTIVE`);
        setResults(r.data.results ?? r.data);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 300);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        required={!value}
        placeholder="Rechercher nom ou matricule…"
        value={selectedLabel || q}
        onChange={e => {
          const v = e.target.value;
          setQ(v); setSelectedLabel(''); onChange(''); setOpen(true); search(v);
        }}
        onFocus={() => { setOpen(true); if (q) search(q); }}
        onBlur={() => setTimeout(() => setOpen(false), 200)}
        style={{ ...inputSt, background: value ? '#f0f7ff' : '#fff' }}
      />
      {value && (
        <button type="button"
          onClick={() => { onChange(''); setQ(''); setSelectedLabel(''); setResults([]); }}
          style={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            border: 'none', background: 'none', cursor: 'pointer', color: '#9e9e9e', fontSize: 18,
          }}>×</button>
      )}
      {open && (loading || results.length > 0) && (
        <div style={{
          position: 'absolute', zIndex: 999, background: '#fff',
          border: '1px solid #e0e0e0', borderRadius: 8, width: '100%',
          maxHeight: 220, overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          top: '100%', marginTop: 2,
        }}>
          {loading && <div style={{ padding: '10px 12px', fontSize: 13, color: '#9e9e9e' }}>Recherche…</div>}
          {!loading && results.map(e => (
            <div key={e.id}
              onMouseDown={() => {
                onChange(String(e.id));  // send pk (e.g. 25235), NOT employee_id
                // display: first_name + last_name + employee_id (matricule)
                setSelectedLabel(
                  `${e.first_name} ${e.last_name}${e.employee_id ? ' — ' + e.employee_id : ''}`
                );
                setQ(''); setOpen(false);
              }}
              style={{
                padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                borderBottom: '1px solid #f5f5f5',
                background: String(e.id) === String(value) ? '#e3f2fd' : '#fff',
              }}
            >
              <strong>{e.first_name} {e.last_name}</strong>
              {/* field is employee_id, NOT matricule */}
              {e.employee_id && (
                <span style={{ color: '#9e9e9e', marginLeft: 8 }}>{e.employee_id}</span>
              )}
            </div>
          ))}
        </div>
      )}
      {open && !loading && q.length >= 1 && results.length === 0 && (
        <div style={{
          position: 'absolute', zIndex: 999, background: '#fff',
          border: '1px solid #e0e0e0', borderRadius: 8, width: '100%',
          padding: '10px 12px', fontSize: 13, color: '#9e9e9e', top: '100%', marginTop: 2,
        }}>Aucun résultat pour "{q}"</div>
      )}
    </div>
  );
}

const addDays = (dateStr, n) => {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const daysBetween = (a, b) =>
  Math.max(0, Math.round((new Date(b || Date.now()) - new Date(a)) / 86400000));

// ── EMPTY form uses correct backend field names ───────────────────────────────
const EMPTY = {
  employee:            '',
  leave_start_date:    '',
  leave_end_date:      '',
  expected_birth_date: '',
  extended_end_date:   '',
  note:                '',
};

const labelSt = { display: 'block', fontSize: 12, fontWeight: 600, color: '#616161', marginBottom: 4 };
const inputSt = {
  width: '100%', padding: '8px 10px', borderRadius: 8,
  border: '1px solid #e0e0e0', fontSize: 13, boxSizing: 'border-box',
  outline: 'none', background: '#fff', color: '#212121',
};

export default function MaternityLeave() {
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editRec, setEditRec]   = useState(null);
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('all');
  const [endAlerts, setEndAlerts] = useState([]);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await hrClient.get('leaves/maternity/');
      const recs = res.data.results ?? res.data;
      setRecords(recs);
      const today = new Date();
      // Alerts for leaves ending within 7 days
      setEndAlerts(
        recs
          .filter(r => ['ON_LEAVE', 'EXTENDED'].includes(r.status))
          .map(r => ({
            ...r,
            diff: Math.round((new Date(r.leave_end_date) - today) / 86400000),
          }))
          .filter(r => r.diff >= 0 && r.diff <= 7)
      );
    } catch {
      setError("Impossible de charger les données. Vérifiez la connexion au serveur.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditRec(null); setForm(EMPTY); setShowForm(true); };

  const openEdit = rec => {
    setEditRec(rec);
    setForm({
      employee:            rec.employee,
      leave_start_date:    rec.leave_start_date,
      leave_end_date:      rec.leave_end_date,
      expected_birth_date: rec.expected_birth_date || '',
      extended_end_date:   rec.extended_end_date   || '',
      note:                rec.note                || '',
    });
    setShowForm(true);
  };

  const handleSave = async e => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form };
      // Remove empty optional fields so backend doesn't complain
      if (!payload.extended_end_date)   delete payload.extended_end_date;
      if (!payload.expected_birth_date) delete payload.expected_birth_date;
      if (!payload.note)                delete payload.note;

      if (editRec) {
        await hrClient.patch(`leaves/maternity/${editRec.id}/`, payload);
      } else {
        await hrClient.post('leaves/maternity/', payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      const detail = err.response?.data;
      alert('Erreur : ' + (detail ? JSON.stringify(detail) : 'Vérifiez les champs.'));
    } finally { setSaving(false); }
  };

  const handleCancel = async id => {
    if (!window.confirm('Annuler ce congé maternité ?')) return;
    await hrClient.patch(`leaves/maternity/${id}/`, { status: 'CANCELLED' });
    load();
  };

  const handleEnd = async id => {
    const date = window.prompt('Date de retour réelle (YYYY-MM-DD) :');
    if (!date) return;
    await hrClient.post(`leaves/maternity/${id}/mark_returned/`, { return_date: date });
    load();
  };

  const filtered = records.filter(r => {
    const name = `${r.employee_name || ''} ${r.employee_id_str || ''}`.toLowerCase();
    return name.includes(search.toLowerCase()) && (filter === 'all' || r.status === filter);
  });

  const stats = {
    DECLARED:  records.filter(r => r.status === 'DECLARED').length,
    ON_LEAVE:  records.filter(r => r.status === 'ON_LEAVE').length,
    RETURNED:  records.filter(r => r.status === 'RETURNED').length,
    total:     records.length,
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#9e9e9e', fontSize: 14 }}>
      Chargement…
    </div>
  );

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '24px 16px', fontFamily: 'system-ui, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#212121' }}>Congé maternité</h1>
          <p style={{ fontSize: 13, color: '#757575', margin: '4px 0 0' }}>Suivi des congés — 98 jours légaux</p>
        </div>
        <button onClick={openCreate} style={{
          background: '#1976d2', color: '#fff', border: 'none',
          borderRadius: 8, padding: '9px 18px', fontSize: 13,
          fontWeight: 600, cursor: 'pointer',
        }}>+ Nouveau congé</button>
      </div>

      {endAlerts.map(a => (
        <AlertBanner key={a.id} type={a.diff <= 2 ? 'danger' : 'warning'}>
          ⚠ <strong>{a.employee_name}</strong> — fin prévue dans{' '}
          <strong>{a.diff === 0 ? "aujourd'hui" : `${a.diff} j`}</strong>
          {' '}({a.leave_end_date})
        </AlertBanner>
      ))}

      {error && <AlertBanner type="danger">{error}</AlertBanner>}

      <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
        <StatCard label="Déclarées"  value={stats.DECLARED} color="#f57c00" />
        <StatCard label="En congé"   value={stats.ON_LEAVE} color="#1976d2" />
        <StatCard label="Reprises"   value={stats.RETURNED} color="#388e3c" />
        <StatCard label="Total"      value={stats.total}    color="#7b1fa2" />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <input
          placeholder="Rechercher une employée…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13 }}
        />
        {['all', 'DECLARED', 'ON_LEAVE', 'EXTENDED', 'RETURNED', 'CANCELLED'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 13px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid', cursor: 'pointer',
            borderColor: filter === f ? '#1976d2' : '#e0e0e0',
            background:  filter === f ? '#e3f2fd' : '#fff',
            color:       filter === f ? '#1565c0' : '#757575',
          }}>
            {f === 'all' ? 'Tous' : STATUS_COLORS[f]?.label ?? f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#bdbdbd', padding: '48px 0', fontSize: 14 }}>
          Aucun enregistrement.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map(rec => {
            // use leave_start_date and actual_return_date (correct field names)
            const elapsed  = daysBetween(rec.leave_start_date, rec.actual_return_date || undefined);
            const barColor = rec.status === 'RETURNED'  ? '#388e3c'
                           : rec.status === 'CANCELLED' ? '#bdbdbd' : '#1976d2';
            const name     = rec.employee_name || `#${rec.employee}`;
            const initials = name.slice(0, 2).toUpperCase();

            return (
              <div key={rec.id} style={{
                background: '#fff', border: '1px solid #e0e0e0',
                borderRadius: 10, padding: '14px 18px',
              }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                    background: '#e3f2fd', color: '#1565c0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14,
                  }}>{initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#212121' }}>{name}</span>
                      {rec.employee_id_str && (
                        <span style={{ fontSize: 11, color: '#9e9e9e' }}>{rec.employee_id_str}</span>
                      )}
                      <Badge status={rec.status} />
                    </div>
                    <div style={{ fontSize: 12, color: '#757575', marginBottom: 8 }}>
                      Début : <strong>{rec.leave_start_date}</strong>
                      {' · '}Fin légale : <strong>{rec.leave_end_date}</strong>
                      {rec.extended_end_date && <> · Prolongée : <strong>{rec.extended_end_date}</strong></>}
                      {rec.actual_return_date && <> · Retour réel : <strong>{rec.actual_return_date}</strong></>}
                      {rec.expected_birth_date && <> · Accouchement prévu : <strong>{rec.expected_birth_date}</strong></>}
                      {' · '}<strong>{elapsed}</strong> / 98 jours
                    </div>
                    <ProgressBar value={elapsed} max={98} color={barColor} />
                    {rec.note && (
                      <div style={{ fontSize: 12, color: '#9e9e9e', marginTop: 6, fontStyle: 'italic' }}>{rec.note}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => openEdit(rec)} style={{
                      padding: '5px 11px', fontSize: 12, borderRadius: 6,
                      border: '1px solid #e0e0e0', background: '#fafafa', cursor: 'pointer', color: '#424242',
                    }}>Modifier</button>
                    {['ON_LEAVE', 'EXTENDED'].includes(rec.status) && <>
                      <button onClick={() => handleEnd(rec.id)} style={{
                        padding: '5px 11px', fontSize: 12, borderRadius: 6,
                        border: '1px solid #c8e6c9', background: '#e8f5e9', cursor: 'pointer', color: '#2e7d32',
                      }}>Clôturer</button>
                      <button onClick={() => handleCancel(rec.id)} style={{
                        padding: '5px 11px', fontSize: 12, borderRadius: 6,
                        border: '1px solid #ffcdd2', background: '#fce4ec', cursor: 'pointer', color: '#c62828',
                      }}>Annuler</button>
                    </>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: '28px 32px',
            width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 20px', color: '#212121' }}>
              {editRec ? 'Modifier le congé' : 'Nouveau congé maternité'}
            </h2>
            <form onSubmit={handleSave}>

              {/* Employee */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Employée *</label>
                {editRec ? (
                  <input style={inputSt} disabled
                    value={editRec.employee_name || `#${editRec.employee}`} />
                ) : (
                  <EmpSearch value={form.employee}
                    onChange={id => setForm(f => ({ ...f, employee: id }))} />
                )}
              </div>

              {/* leave_start_date + leave_end_date */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelSt}>Date de début *</label>
                  <input type="date" required value={form.leave_start_date}
                    onChange={e => {
                      const s = e.target.value;
                      setForm(f => ({
                        ...f,
                        leave_start_date: s,
                        leave_end_date: s ? addDays(s, 97) : '',
                      }));
                    }}
                    style={inputSt}
                  />
                </div>
                <div>
                  <label style={labelSt}>Fin légale (98 j) *</label>
                  <input type="date" required value={form.leave_end_date}
                    onChange={e => setForm(f => ({ ...f, leave_end_date: e.target.value }))}
                    style={inputSt}
                  />
                </div>
              </div>

              {/* expected_birth_date */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Date accouchement prévue *</label>
                <input type="date" required value={form.expected_birth_date}
                  onChange={e => setForm(f => ({ ...f, expected_birth_date: e.target.value }))}
                  style={inputSt}
                />
              </div>

              {/* extended_end_date */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelSt}>Date fin prolongée</label>
                <input type="date" value={form.extended_end_date}
                  onChange={e => setForm(f => ({ ...f, extended_end_date: e.target.value }))}
                  style={inputSt}
                />
                <div style={{ fontSize: 11, color: '#9e9e9e', marginTop: 3 }}>
                  Laisser vide si pas de prolongation.
                </div>
              </div>

              {/* note (not "notes") */}
              <div style={{ marginBottom: 20 }}>
                <label style={labelSt}>Notes</label>
                <textarea rows={3} value={form.note}
                  placeholder="Observations, complications, etc."
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  style={{ ...inputSt, resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{
                  padding: '8px 18px', borderRadius: 8, border: '1px solid #e0e0e0',
                  background: '#fafafa', fontSize: 13, cursor: 'pointer', color: '#424242',
                }}>Annuler</button>
                <button type="submit" disabled={saving} style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: '#1976d2', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>
                  {saving ? 'Enregistrement…' : editRec ? 'Mettre à jour' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
