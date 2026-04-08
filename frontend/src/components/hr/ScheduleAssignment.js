// =====================================================
// PATH: pointage/frontend/src/components/hr/ScheduleAssignment.js
// NEW PAGE: /hr/schedule-assignment
// =====================================================
//
// HOW TO WIRE IT UP:
//   1. Copy this file to frontend/src/components/hr/
//   2. In App.js:
//        import ScheduleAssignment from "./components/hr/ScheduleAssignment";
//        <Route path="hr/schedule-assignment" element={<ScheduleAssignment />} />
//   3. In DashboardLayout.js hrMenuItems:
//        { to: "/hr/schedule-assignment", label: "Assignation horaires", module: "employees" },
// =====================================================

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Box, Typography, Paper, Chip, IconButton, Tooltip,
  Button, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem, Grid,
  Alert, CircularProgress, Divider, Switch, FormControlLabel,
  InputAdornment, Autocomplete, Avatar, Badge, Tabs, Tab,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Checkbox, LinearProgress,
} from "@mui/material";
import AddIcon           from "@mui/icons-material/Add";
import EditIcon          from "@mui/icons-material/Edit";
import DeleteIcon        from "@mui/icons-material/Delete";
import RefreshIcon       from "@mui/icons-material/Refresh";
import SearchIcon        from "@mui/icons-material/Search";
import ScheduleIcon      from "@mui/icons-material/Schedule";
import PersonIcon        from "@mui/icons-material/Person";
import GroupsIcon        from "@mui/icons-material/Groups";
import ApartmentIcon     from "@mui/icons-material/Apartment";
import CheckCircleIcon   from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import FilterListIcon    from "@mui/icons-material/FilterList";
import AssignmentIcon    from "@mui/icons-material/Assignment";
import ContentCopyIcon   from "@mui/icons-material/ContentCopy";
import AccessTimeFilledIcon from "@mui/icons-material/AccessTimeFilled";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (t) => (t || "").slice(0, 5);

const PRESETS = [
  {
    label: "Journée standard",
    color: "#0891b2",
    icon: "🏢",
    values: {
      work_start: "07:40", early_leave_limit: "16:27",
      standard_start: "07:30", standard_end: "16:30",
      lunch_start: "12:00", lunch_end: "13:00",
      standard_work_hours: 8.0, overtime_threshold_hours: 8.5,
    },
  },
  {
    label: "Poste matin (6h–14h)",
    color: "#f59e0b",
    icon: "🌅",
    values: {
      work_start: "06:10", early_leave_limit: "13:50",
      standard_start: "06:00", standard_end: "14:00",
      lunch_start: "10:00", lunch_end: "10:30",
      standard_work_hours: 7.5, overtime_threshold_hours: 8.0,
    },
  },
  {
    label: "Poste après-midi (14h–22h)",
    color: "#8b5cf6",
    icon: "🌆",
    values: {
      work_start: "14:10", early_leave_limit: "21:50",
      standard_start: "14:00", standard_end: "22:00",
      lunch_start: "18:00", lunch_end: "18:30",
      standard_work_hours: 7.5, overtime_threshold_hours: 8.0,
    },
  },
  {
    label: "Demi-journée matin",
    color: "#10b981",
    icon: "⏰",
    values: {
      work_start: "07:40", early_leave_limit: "11:50",
      standard_start: "07:30", standard_end: "12:00",
      lunch_start: "00:00", lunch_end: "00:00",
      standard_work_hours: 4.0, overtime_threshold_hours: 4.5,
    },
  },
  {
    label: "Horaire flexible (9h–17h)",
    color: "#ec4899",
    icon: "🔄",
    values: {
      work_start: "09:10", early_leave_limit: "16:50",
      standard_start: "09:00", standard_end: "17:00",
      lunch_start: "12:30", lunch_end: "13:30",
      standard_work_hours: 7.0, overtime_threshold_hours: 7.5,
    },
  },
  {
    label: "Allaitement (→15h30)",
    color: "#f43f5e",
    icon: "🤱",
    values: {
      work_start: "07:40", early_leave_limit: "15:27",
      standard_start: "07:30", standard_end: "15:30",
      lunch_start: "12:00", lunch_end: "13:00",
      standard_work_hours: 7.0, overtime_threshold_hours: 7.5,
    },
  },
  {
    label: "Personnalisé",
    color: "#64748b",
    icon: "✏️",
    values: null, // signals custom mode
  },
];

const EMPTY_FORM = {
  name: "", description: "",
  work_start: "07:40", early_leave_limit: "16:27",
  standard_start: "07:30", standard_end: "16:30",
  lunch_start: "12:00", lunch_end: "13:00",
  standard_work_hours: 8.0, overtime_threshold_hours: 8.5,
  valid_from: "", valid_until: "",
  is_active: true,
};

/** Convert "HH:MM" to percentage of 24h for timeline rendering */
const timeToPct = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return ((h * 60 + m) / (24 * 60)) * 100;
};

const STATUS_COLORS = {
  ACTIVE: "#22c55e", INACTIVE: "#94a3b8", ON_LEAVE: "#f59e0b", TERMINATED: "#ef4444",
};

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Visual 24h timeline bar for a schedule */
function TimelineBar({ schedule, height = 32, showLabels = true }) {
  const startPct = timeToPct(schedule.standard_start);
  const endPct   = timeToPct(schedule.standard_end);
  const lunchS   = timeToPct(schedule.lunch_start);
  const lunchE   = timeToPct(schedule.lunch_end);
  const width    = endPct - startPct;
  const lunchW   = lunchE - lunchS;
  const lunchOffset = lunchS - startPct;

  return (
    <Box>
      {/* 24h bar */}
      <Box sx={{
        position: "relative", height, borderRadius: 1,
        backgroundColor: "#f1f5f9", overflow: "visible",
      }}>
        {/* Work block */}
        <Box sx={{
          position: "absolute",
          left: `${startPct}%`,
          width: `${width}%`,
          height: "100%",
          backgroundColor: "#bfdbfe",
          borderRadius: 1,
        }} />
        {/* Lunch block */}
        {lunchW > 0 && (
          <Box sx={{
            position: "absolute",
            left: `${startPct + lunchOffset}%`,
            width: `${lunchW}%`,
            height: "100%",
            backgroundColor: "#fde68a",
            borderRadius: 0,
          }} />
        )}
        {/* Start marker */}
        <Box sx={{
          position: "absolute", left: `${startPct}%`,
          height: "100%", width: 2, backgroundColor: "#3b82f6",
        }} />
        {/* End marker */}
        <Box sx={{
          position: "absolute", left: `${endPct}%`,
          height: "100%", width: 2, backgroundColor: "#ef4444",
        }} />
        {/* Hour markers */}
        {[6, 8, 10, 12, 14, 16, 18, 20, 22].map(h => (
          <Box key={h} sx={{
            position: "absolute",
            left: `${(h / 24) * 100}%`,
            height: "30%", top: "70%",
            width: 1, backgroundColor: "#cbd5e1",
          }} />
        ))}
      </Box>
      {showLabels && (
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 0.25 }}>
          <Typography variant="caption" sx={{ fontSize: 10, color: "text.disabled" }}>0h</Typography>
          {[6,12,18].map(h => (
            <Typography key={h} variant="caption" sx={{ fontSize: 10, color: "text.disabled" }}>{h}h</Typography>
          ))}
          <Typography variant="caption" sx={{ fontSize: 10, color: "text.disabled" }}>24h</Typography>
        </Box>
      )}
    </Box>
  );
}

/** Preset card for selection */
function PresetCard({ preset, selected, onClick }) {
  return (
    <Paper
      onClick={onClick}
      elevation={selected ? 4 : 1}
      sx={{
        p: 1.5, cursor: "pointer", borderRadius: 2,
        border: `2px solid ${selected ? preset.color : "#e2e8f0"}`,
        backgroundColor: selected ? `${preset.color}11` : "white",
        transition: "all 0.15s ease",
        "&:hover": { borderColor: preset.color, transform: "translateY(-1px)", boxShadow: 3 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontSize: 18 }}>{preset.icon}</Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: selected ? preset.color : "text.primary", fontSize: 12 }}>
          {preset.label}
        </Typography>
        {selected && <CheckCircleIcon sx={{ fontSize: 14, color: preset.color, ml: "auto" }} />}
      </Box>
      {preset.values && (
        <Typography variant="caption" sx={{ color: "text.secondary", fontFamily: "monospace", fontSize: 10 }}>
          {fmt(preset.values.standard_start)} – {fmt(preset.values.standard_end)}
        </Typography>
      )}
    </Paper>
  );
}

/** Employee row card in the roster */
function EmployeeRow({ employee, schedule, selected, onSelect, onAssign, canWrite }) {
  return (
    <TableRow
      hover
      sx={{
        cursor: "pointer",
        backgroundColor: selected ? "#eff6ff" : "inherit",
        "&:hover": { backgroundColor: selected ? "#dbeafe" : "#f8fafc" },
      }}
      onClick={canWrite ? onSelect : undefined}
    >
      <TableCell padding="checkbox">
        {canWrite && (
          <Checkbox
            checked={selected}
            onChange={onSelect}
            onClick={e => e.stopPropagation()}
            size="small"
          />
        )}
      </TableCell>
      <TableCell>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{
            width: 32, height: 32, fontSize: 12,
            backgroundColor: STATUS_COLORS[employee.status] + "33",
            color: STATUS_COLORS[employee.status],
            fontWeight: 700,
          }}>
            {employee.first_name?.[0]}{employee.last_name?.[0]}
          </Avatar>
          <Box>
            <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
              {employee.last_name} {employee.first_name}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
              {employee.employee_id}
            </Typography>
          </Box>
        </Box>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">{employee.job_title}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="caption" color="text.secondary">{employee.department_name}</Typography>
      </TableCell>
      <TableCell sx={{ minWidth: 220 }}>
        {schedule ? (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 0.5 }}>
              <Box sx={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#22c55e" }} />
              <Typography variant="caption" fontWeight={700} color="success.dark">
                {schedule.name}
              </Typography>
              {schedule.valid_until && (
                <Chip label={`→ ${schedule.valid_until}`} size="small"
                  sx={{ height: 16, fontSize: 9, backgroundColor: "#fef3c7", color: "#92400e" }} />
              )}
            </Box>
            <TimelineBar schedule={schedule} height={14} showLabels={false} />
            <Box sx={{ display: "flex", gap: 1, mt: 0.25 }}>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#3b82f6", fontSize: 10 }}>
                {fmt(schedule.standard_start)}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>–</Typography>
              <Typography variant="caption" sx={{ fontFamily: "monospace", color: "#ef4444", fontSize: 10 }}>
                {fmt(schedule.standard_end)}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.disabled", fontSize: 10 }}>
                · {schedule.standard_work_hours}h/j
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <RadioButtonUncheckedIcon sx={{ fontSize: 14, color: "#cbd5e1" }} />
            <Typography variant="caption" color="text.disabled" sx={{ fontStyle: "italic" }}>
              Horaire par défaut (07:30–16:30)
            </Typography>
          </Box>
        )}
      </TableCell>
      {canWrite && (
        <TableCell align="right">
          <Tooltip title={schedule ? "Modifier l'horaire" : "Assigner un horaire"}>
            <IconButton
              size="small"
              color={schedule ? "primary" : "default"}
              onClick={(e) => { e.stopPropagation(); onAssign(); }}
            >
              {schedule ? <EditIcon fontSize="small" /> : <AddIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </TableCell>
      )}
    </TableRow>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function ScheduleAssignment() {
  const { can } = useHRAuth();
  const canWrite = can("employees_write");

  // ── Data ──────────────────────────────────────────────────────────────────
  const [employees,   setEmployees]   = useState([]);
  const [schedules,   setSchedules]   = useState([]);   // all WorkSchedule objects
  const [departments, setDepts]       = useState([]);
  const [sections,    setSections]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [alert,       setAlert]       = useState(null);

  // ── Filters ───────────────────────────────────────────────────────────────
  const [search,      setSearch]      = useState("");
  const [deptFilter,  setDeptFilter]  = useState("");
  const [schedFilter, setSchedFilter] = useState(""); // "assigned" | "unassigned" | ""

  // ── Selection ─────────────────────────────────────────────────────────────
  const [selected, setSelected]       = useState(new Set());  // employee IDs
  const [tab, setTab]                 = useState(0);          // 0=roster, 1=overview

  // ── Modal ─────────────────────────────────────────────────────────────────
  const [modal,       setModal]       = useState(false);
  const [modalMode,   setModalMode]   = useState("single"); // "single" | "bulk"
  const [targetEmp,   setTargetEmp]   = useState(null);     // for single mode
  const [existingSch, setExistingSch] = useState(null);     // existing schedule to edit

  const [selectedPreset, setSelectedPreset] = useState(null);
  const [form,           setForm]           = useState(EMPTY_FORM);
  const [errors,         setErrors]         = useState({});
  const [customMode,     setCustomMode]     = useState(false); // show custom time fields

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [empR, schR, deptR, sectR] = await Promise.all([
        hrClient.get("employees/?page_size=500&status=ACTIVE"),
        hrClient.get("employees/work-schedules/?page_size=500"),
        hrClient.get("employees/departments/?page_size=200"),
        hrClient.get("employees/sections/?page_size=300"),
      ]);
      setEmployees(empR.data.results || empR.data);
      setSchedules(schR.data.results || schR.data);
      setDepts(deptR.data.results || deptR.data);
      setSections(sectR.data.results || sectR.data);
    } catch (e) {
      setAlert({ type: "error", msg: "Erreur lors du chargement des données." });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Derived: map employee → their active schedule ─────────────────────────
  const empScheduleMap = useMemo(() => {
    const map = {};
    schedules
      .filter(s => s.is_active && s.employee)
      .forEach(s => {
        const empId = s.employee;
        // Keep most recently created (highest id) if multiple
        if (!map[empId] || s.id > map[empId].id) map[empId] = s;
      });
    return map;
  }, [schedules]);

  // ── Filtered employee list ────────────────────────────────────────────────
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const q = search.toLowerCase();
      const matchSearch = !q || [emp.first_name, emp.last_name, emp.employee_id, emp.job_title]
        .some(f => (f || "").toLowerCase().includes(q));
      const matchDept = !deptFilter || String(emp.department) === String(deptFilter);
      const hasSch    = !!empScheduleMap[emp.id];
      const matchSch  = !schedFilter
        || (schedFilter === "assigned"   &&  hasSch)
        || (schedFilter === "unassigned" && !hasSch);
      return matchSearch && matchDept && matchSch;
    });
  }, [employees, search, deptFilter, schedFilter, empScheduleMap]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const assignedCount   = employees.filter(e => empScheduleMap[e.id]).length;
  const unassignedCount = employees.length - assignedCount;

  // ── Selection helpers ─────────────────────────────────────────────────────
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selected.size === filteredEmployees.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredEmployees.map(e => e.id)));
    }
  };
  const clearSelection = () => setSelected(new Set());

  // ── Open modal helpers ────────────────────────────────────────────────────
  const openSingle = (employee) => {
    const existing = empScheduleMap[employee.id];
    setTargetEmp(employee);
    setExistingSch(existing || null);
    setModalMode("single");
    setSelectedPreset(null);
    setCustomMode(false);
    setForm({
      ...EMPTY_FORM,
      ...(existing ? {
        name: existing.name, description: existing.description || "",
        work_start: existing.work_start, early_leave_limit: existing.early_leave_limit,
        standard_start: existing.standard_start, standard_end: existing.standard_end,
        lunch_start: existing.lunch_start, lunch_end: existing.lunch_end,
        standard_work_hours: existing.standard_work_hours,
        overtime_threshold_hours: existing.overtime_threshold_hours,
        valid_from: existing.valid_from || "", valid_until: existing.valid_until || "",
        is_active: existing.is_active, id: existing.id,
      } : {}),
    });
    setErrors({});
    setModal(true);
  };

  const openBulk = () => {
    setModalMode("bulk");
    setSelectedPreset(null);
    setCustomMode(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setModal(true);
  };

  const close = () => {
    setModal(false);
    setSelectedPreset(null);
    setCustomMode(false);
    setForm(EMPTY_FORM);
    setErrors({});
    setTargetEmp(null);
    setExistingSch(null);
  };

  // ── Apply preset to form ──────────────────────────────────────────────────
  const applyPreset = (preset) => {
    setSelectedPreset(preset);
    if (preset.values === null) {
      // custom
      setCustomMode(true);
      setForm(prev => ({ ...prev, name: prev.name || "Horaire personnalisé" }));
    } else {
      setCustomMode(false);
      setForm(prev => ({
        ...prev,
        ...preset.values,
        name: prev.name || preset.label,
      }));
    }
  };

  // ── Validate ──────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name = "Requis";
    if (!form.work_start)        e.work_start = "Requis";
    if (!form.early_leave_limit) e.early_leave_limit = "Requis";
    if (!form.standard_start)    e.standard_start = "Requis";
    if (!form.standard_end)      e.standard_end = "Requis";
    setErrors(e);
    return !Object.keys(e).length;
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!validate()) return;
    setSaving(true);

    const basePayload = {
      name:                     form.name,
      description:              form.description,
      work_start:               form.work_start,
      early_leave_limit:        form.early_leave_limit,
      standard_start:           form.standard_start,
      standard_end:             form.standard_end,
      lunch_start:              form.lunch_start,
      lunch_end:                form.lunch_end,
      standard_work_hours:      Number(form.standard_work_hours),
      overtime_threshold_hours: Number(form.overtime_threshold_hours),
      valid_from:               form.valid_from  || null,
      valid_until:              form.valid_until || null,
      is_active:                form.is_active,
      department: null,
      section:    null,
    };

    try {
      if (modalMode === "single") {
        const payload = { ...basePayload, employee: targetEmp.id };
        if (existingSch) {
          await hrClient.patch(`employees/work-schedules/${existingSch.id}/`, payload);
        } else {
          await hrClient.post("employees/work-schedules/", payload);
        }
        setAlert({ type: "success", msg: `Horaire assigné à ${targetEmp.last_name} ${targetEmp.first_name}.` });
        clearSelection();
      } else {
        // Bulk: assign to all selected employees
        const empIds = Array.from(selected);
        await Promise.all(empIds.map(async (empId) => {
          const existing = empScheduleMap[empId];
          const payload  = { ...basePayload, employee: empId };
          if (existing) {
            return hrClient.patch(`employees/work-schedules/${existing.id}/`, payload);
          } else {
            return hrClient.post("employees/work-schedules/", payload);
          }
        }));
        setAlert({ type: "success", msg: `Horaire assigné à ${empIds.length} employé(s).` });
        clearSelection();
      }
      close();
      fetchAll();
    } catch (err) {
      const d = err.response?.data;
      if (d && typeof d === "object") setErrors(d);
      else setAlert({ type: "error", msg: "Erreur lors de la sauvegarde." });
    } finally { setSaving(false); }
  };

  // ── Delete schedule ───────────────────────────────────────────────────────
  const removeSchedule = async (schedule) => {
    if (!window.confirm(`Supprimer l'horaire "${schedule.name}" ? L'employé reviendra à l'horaire par défaut.`)) return;
    try {
      await hrClient.delete(`employees/work-schedules/${schedule.id}/`);
      setAlert({ type: "success", msg: "Horaire supprimé." });
      fetchAll();
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de la suppression." });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box sx={{ p: 3, backgroundColor: "#f8fafc", minHeight: "100vh" }}>

      {/* ── Header ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box sx={{
            width: 52, height: 52, borderRadius: 2.5,
            background: "linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px #1d4ed833",
          }}>
            <AccessTimeFilledIcon sx={{ color: "white", fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={800} sx={{ letterSpacing: -0.5 }}>
              Assignation des horaires
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Assignez des horaires de travail individuellement ou en masse
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Tooltip title="Actualiser">
            <IconButton onClick={fetchAll}><RefreshIcon /></IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* ── Stat cards ── */}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        {[
          { label: "Employés actifs",    value: employees.length,   color: "#1d4ed8", bg: "#eff6ff" },
          { label: "Avec horaire perso", value: assignedCount,      color: "#059669", bg: "#ecfdf5" },
          { label: "Horaire par défaut", value: unassignedCount,    color: "#d97706", bg: "#fffbeb" },
          { label: "Types d'horaires",   value: schedules.filter(s => !s.employee).length, color: "#7c3aed", bg: "#f5f3ff" },
        ].map(s => (
          <Paper key={s.label} elevation={0} sx={{
            px: 2.5, py: 1.5, borderRadius: 2, flex: "1 1 140px",
            border: `1px solid ${s.color}22`, backgroundColor: s.bg,
          }}>
            <Typography variant="h4" fontWeight={800} sx={{ color: s.color, lineHeight: 1 }}>
              {s.value}
            </Typography>
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Paper>
        ))}
      </Box>

      {alert && (
        <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>
          {alert.msg}
        </Alert>
      )}

      {/* ── Tabs ── */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Roster des employés" />
        <Tab label="Vue par type d'horaire" />
      </Tabs>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 0 — Roster */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 0 && (
        <>
          {/* Toolbar */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, alignItems: "center", flexWrap: "wrap" }}>
            <TextField
              placeholder="Rechercher un employé..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              size="small" sx={{ minWidth: 240 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Département</InputLabel>
              <Select value={deptFilter} label="Département"
                onChange={e => setDeptFilter(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                {departments.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <InputLabel>Filtre horaire</InputLabel>
              <Select value={schedFilter} label="Filtre horaire"
                onChange={e => setSchedFilter(e.target.value)}>
                <MenuItem value="">Tous</MenuItem>
                <MenuItem value="assigned">Avec horaire</MenuItem>
                <MenuItem value="unassigned">Sans horaire</MenuItem>
              </Select>
            </FormControl>

            {/* Bulk action bar */}
            {selected.size > 0 && canWrite && (
              <Box sx={{
                display: "flex", alignItems: "center", gap: 1.5,
                px: 2, py: 0.75, borderRadius: 2,
                backgroundColor: "#1d4ed8", color: "white",
                ml: "auto",
              }}>
                <Typography variant="body2" fontWeight={700}>
                  {selected.size} sélectionné(s)
                </Typography>
                <Button
                  size="small" variant="contained"
                  sx={{ backgroundColor: "white", color: "#1d4ed8", fontWeight: 700,
                        "&:hover": { backgroundColor: "#eff6ff" } }}
                  startIcon={<AssignmentIcon />}
                  onClick={openBulk}
                >
                  Assigner un horaire
                </Button>
                <Button
                  size="small"
                  sx={{ color: "white", borderColor: "white" }}
                  variant="outlined"
                  onClick={clearSelection}
                >
                  Annuler
                </Button>
              </Box>
            )}
          </Box>

          {/* Table */}
          {loading ? (
            <LinearProgress sx={{ borderRadius: 1 }} />
          ) : (
            <TableContainer component={Paper} elevation={2} sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f1f5f9" }}>
                    {canWrite && (
                      <TableCell padding="checkbox">
                        <Checkbox
                          indeterminate={selected.size > 0 && selected.size < filteredEmployees.length}
                          checked={filteredEmployees.length > 0 && selected.size === filteredEmployees.length}
                          onChange={toggleAll}
                          size="small"
                        />
                      </TableCell>
                    )}
                    <TableCell><strong>Employé</strong></TableCell>
                    <TableCell><strong>Poste</strong></TableCell>
                    <TableCell><strong>Département</strong></TableCell>
                    <TableCell><strong>Horaire actuel</strong></TableCell>
                    {canWrite && <TableCell align="right"><strong>Action</strong></TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredEmployees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={canWrite ? 6 : 5} align="center"
                        sx={{ py: 6, color: "text.secondary", fontStyle: "italic" }}>
                        Aucun employé trouvé
                      </TableCell>
                    </TableRow>
                  ) : filteredEmployees.map(emp => (
                    <EmployeeRow
                      key={emp.id}
                      employee={emp}
                      schedule={empScheduleMap[emp.id] || null}
                      selected={selected.has(emp.id)}
                      onSelect={() => toggleSelect(emp.id)}
                      onAssign={() => openSingle(emp)}
                      canWrite={canWrite}
                    />
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            {filteredEmployees.length} employé(s) affiché(s)
            {selected.size > 0 && ` · ${selected.size} sélectionné(s)`}
          </Typography>
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* TAB 1 — Overview by schedule type */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 1 && (
        <Box>
          {/* Group: employees using each schedule type */}
          {PRESETS.filter(p => p.values).map(preset => {
            const matched = employees.filter(emp => {
              const sch = empScheduleMap[emp.id];
              if (!sch) return false;
              return sch.standard_start === preset.values.standard_start
                  && sch.standard_end   === preset.values.standard_end;
            });
            return matched.length === 0 ? null : (
              <Paper key={preset.label} elevation={1} sx={{ mb: 2, borderRadius: 2, overflow: "hidden" }}>
                <Box sx={{
                  px: 2.5, py: 1.5,
                  borderLeft: `4px solid ${preset.color}`,
                  backgroundColor: `${preset.color}0d`,
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  <Typography sx={{ fontSize: 22 }}>{preset.icon}</Typography>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700}>{preset.label}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                      {fmt(preset.values.standard_start)} – {fmt(preset.values.standard_end)}
                      {" · "}{preset.values.standard_work_hours}h/j
                    </Typography>
                  </Box>
                  <Box sx={{ minWidth: 220 }}>
                    <TimelineBar schedule={preset.values} height={24} />
                  </Box>
                  <Chip label={`${matched.length} employé(s)`} size="small"
                    sx={{ backgroundColor: preset.color, color: "white", fontWeight: 700 }} />
                </Box>
                <Box sx={{ px: 2, py: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {matched.map(emp => (
                    <Chip
                      key={emp.id}
                      avatar={<Avatar sx={{ width: 20, height: 20, fontSize: 9, bgcolor: preset.color + "44", color: preset.color }}>
                        {emp.first_name?.[0]}{emp.last_name?.[0]}
                      </Avatar>}
                      label={`${emp.last_name} ${emp.first_name}`}
                      size="small" variant="outlined"
                      sx={{ borderColor: preset.color + "66" }}
                    />
                  ))}
                </Box>
              </Paper>
            );
          })}

          {/* Custom schedules (don't match any preset exactly) */}
          {(() => {
            const customEmps = employees.filter(emp => {
              const sch = empScheduleMap[emp.id];
              if (!sch) return false;
              return !PRESETS.filter(p => p.values).some(
                p => p.values.standard_start === sch.standard_start
                  && p.values.standard_end   === sch.standard_end
              );
            });
            if (customEmps.length === 0) return null;
            return (
              <Paper elevation={1} sx={{ mb: 2, borderRadius: 2, overflow: "hidden" }}>
                <Box sx={{
                  px: 2.5, py: 1.5,
                  borderLeft: "4px solid #64748b",
                  backgroundColor: "#f8fafc",
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  <Typography sx={{ fontSize: 22 }}>✏️</Typography>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={700}>Horaires personnalisés</Typography>
                    <Typography variant="caption" color="text.secondary">Horaires avec des heures uniques</Typography>
                  </Box>
                  <Chip label={`${customEmps.length} employé(s)`} size="small"
                    sx={{ ml: "auto", backgroundColor: "#64748b", color: "white", fontWeight: 700 }} />
                </Box>
                <Box sx={{ px: 2, py: 1.5, display: "flex", gap: 1, flexWrap: "wrap" }}>
                  {customEmps.map(emp => {
                    const sch = empScheduleMap[emp.id];
                    return (
                      <Chip
                        key={emp.id}
                        label={`${emp.last_name} ${emp.first_name} (${fmt(sch.standard_start)}–${fmt(sch.standard_end)})`}
                        size="small" variant="outlined"
                      />
                    );
                  })}
                </Box>
              </Paper>
            );
          })()}

          {/* Unassigned */}
          {unassignedCount > 0 && (
            <Paper elevation={0} sx={{ borderRadius: 2, border: "1px dashed #cbd5e1" }}>
              <Box sx={{
                px: 2.5, py: 1.5, display: "flex", alignItems: "center", gap: 2,
              }}>
                <Typography sx={{ fontSize: 22 }}>⏱️</Typography>
                <Box>
                  <Typography variant="subtitle1" fontWeight={700} color="text.secondary">
                    Horaire par défaut (07:30–16:30)
                  </Typography>
                  <Typography variant="caption" color="text.disabled">
                    Aucun horaire personnalisé — utilise les règles globales
                  </Typography>
                </Box>
                <Chip label={`${unassignedCount} employé(s)`} size="small"
                  sx={{ ml: "auto", backgroundColor: "#f1f5f9", color: "#64748b", fontWeight: 700 }} />
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ASSIGNMENT MODAL */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={modal} onClose={close} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <AssignmentIcon color="primary" />
            <Box>
              <Typography fontWeight={800}>
                {modalMode === "single"
                  ? (existingSch ? "Modifier l'horaire" : "Assigner un horaire")
                  : `Assigner un horaire à ${selected.size} employé(s)`}
              </Typography>
              {modalMode === "single" && targetEmp && (
                <Typography variant="caption" color="text.secondary">
                  {targetEmp.last_name} {targetEmp.first_name} · {targetEmp.employee_id}
                </Typography>
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          <Grid container spacing={2.5} sx={{ pt: 1 }}>

            {/* ── Step 1: Choose preset ── */}
            <Grid item xs={12}>
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1.5 }}>
                1 · Choisir le type d'horaire
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 1 }}>
                {PRESETS.map(preset => (
                  <PresetCard
                    key={preset.label}
                    preset={preset}
                    selected={selectedPreset?.label === preset.label}
                    onClick={() => applyPreset(preset)}
                  />
                ))}
              </Box>
            </Grid>

            {/* ── Live preview ── */}
            {(selectedPreset && !customMode) && (
              <Grid item xs={12}>
                <Paper elevation={0} sx={{
                  p: 2, borderRadius: 2,
                  border: `1px solid ${selectedPreset.color}44`,
                  backgroundColor: `${selectedPreset.color}08`,
                }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary"
                    sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
                    Aperçu de la journée type
                  </Typography>
                  <Box sx={{ mt: 1.5, mb: 1 }}>
                    <TimelineBar schedule={form} height={36} />
                  </Box>
                  <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                    {[
                      { label: "Arrivée officielle", value: fmt(form.standard_start), color: "#3b82f6", bg: "#eff6ff" },
                      { label: "Tolérance retard",   value: fmt(form.work_start),     color: "#92400e", bg: "#fef3c7" },
                      { label: "Fin de journée",     value: fmt(form.standard_end),   color: "#ef4444", bg: "#fef2f2" },
                      { label: "Départ anticipé si", value: fmt(form.early_leave_limit), color: "#991b1b", bg: "#fee2e2" },
                      { label: "Pause déjeuner",     value: `${fmt(form.lunch_start)}–${fmt(form.lunch_end)}`, color: "#065f46", bg: "#ecfdf5" },
                      { label: "Heures/jour",        value: `${form.standard_work_hours}h`, color: "#4c1d95", bg: "#f5f3ff" },
                    ].map(item => (
                      <Box key={item.label} sx={{ textAlign: "center" }}>
                        <Box sx={{
                          px: 1.5, py: 0.5, borderRadius: 1, mb: 0.25,
                          backgroundColor: item.bg, color: item.color,
                          fontFamily: "monospace", fontWeight: 700, fontSize: 13,
                          display: "inline-block",
                        }}>
                          {item.value}
                        </Box>
                        <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: 10 }}>
                          {item.label}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              </Grid>
            )}

            {/* ── Step 2: Name + custom times ── */}
            {selectedPreset && (
              <>
                <Grid item xs={12}>
                  <Divider>
                    <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: 1.5 }}>
                      2 · Nommer et ajuster
                    </Typography>
                  </Divider>
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField fullWidth size="small" label="Nom de l'horaire *"
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    error={!!errors.name} helperText={errors.name}
                    placeholder="ex: Poste matin – Chaîne A" />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" label="Description / Motif"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </Grid>

                {/* Custom time fields — always shown for "Personnalisé", optional for others */}
                {(customMode || selectedPreset.values === null) && (
                  <>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Arrivée officielle *" type="time"
                        value={form.standard_start}
                        onChange={e => setForm(p => ({ ...p, standard_start: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.standard_start} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Tolérance retard *" type="time"
                        value={form.work_start}
                        onChange={e => setForm(p => ({ ...p, work_start: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.work_start}
                        sx={{ "& .MuiInputBase-root": { backgroundColor: "#fffbeb" } }} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Fin journée *" type="time"
                        value={form.standard_end}
                        onChange={e => setForm(p => ({ ...p, standard_end: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.standard_end} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Départ anticipé si avant *" type="time"
                        value={form.early_leave_limit}
                        onChange={e => setForm(p => ({ ...p, early_leave_limit: e.target.value }))}
                        InputLabelProps={{ shrink: true }}
                        error={!!errors.early_leave_limit}
                        sx={{ "& .MuiInputBase-root": { backgroundColor: "#fff1f2" } }} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Début pause" type="time"
                        value={form.lunch_start}
                        onChange={e => setForm(p => ({ ...p, lunch_start: e.target.value }))}
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Fin pause" type="time"
                        value={form.lunch_end}
                        onChange={e => setForm(p => ({ ...p, lunch_end: e.target.value }))}
                        InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Heures/jour" type="number"
                        inputProps={{ step: 0.5, min: 1, max: 12 }}
                        value={form.standard_work_hours}
                        onChange={e => setForm(p => ({ ...p, standard_work_hours: e.target.value }))} />
                    </Grid>
                    <Grid item xs={6} sm={3}>
                      <TextField fullWidth size="small" label="Seuil heures sup." type="number"
                        inputProps={{ step: 0.5, min: 1, max: 12 }}
                        value={form.overtime_threshold_hours}
                        onChange={e => setForm(p => ({ ...p, overtime_threshold_hours: e.target.value }))} />
                    </Grid>
                  </>
                )}

                {/* Toggle custom times for non-custom presets */}
                {selectedPreset.values !== null && (
                  <Grid item xs={12}>
                    <Button
                      size="small" variant="text"
                      startIcon={<EditIcon fontSize="small" />}
                      onClick={() => setCustomMode(prev => !prev)}
                    >
                      {customMode ? "Masquer les heures personnalisées" : "Ajuster les heures manuellement"}
                    </Button>
                  </Grid>
                )}

                {/* Validity */}
                <Grid item xs={12}>
                  <Divider>
                    <Typography variant="caption" color="text.secondary">Validité (optionnel)</Typography>
                  </Divider>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Valide dès" type="date"
                    value={form.valid_from}
                    onChange={e => setForm(p => ({ ...p, valid_from: e.target.value }))}
                    InputLabelProps={{ shrink: true }} helperText="Vide = immédiatement" />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Expire le" type="date"
                    value={form.valid_until}
                    onChange={e => setForm(p => ({ ...p, valid_until: e.target.value }))}
                    InputLabelProps={{ shrink: true }} helperText="Vide = pas de limite" />
                </Grid>
                <Grid item xs={12}>
                  <FormControlLabel
                    control={<Switch checked={form.is_active}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} />}
                    label="Horaire actif immédiatement"
                  />
                </Grid>
              </>
            )}

            {/* Prompt if no preset chosen yet */}
            {!selectedPreset && (
              <Grid item xs={12}>
                <Box sx={{
                  py: 4, textAlign: "center", color: "text.disabled",
                  border: "1px dashed #cbd5e1", borderRadius: 2,
                }}>
                  <ScheduleIcon sx={{ fontSize: 40, mb: 1, opacity: 0.3 }} />
                  <Typography variant="body2">Sélectionnez un type d'horaire ci-dessus</Typography>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={close} disabled={saving}>Annuler</Button>
          <Button
            variant="contained"
            onClick={save}
            disabled={saving || !selectedPreset}
            startIcon={saving ? <CircularProgress size={16} /> : <AssignmentIcon />}
          >
            {saving
              ? "Enregistrement..."
              : modalMode === "bulk"
                ? `Assigner à ${selected.size} employé(s)`
                : existingSch ? "Mettre à jour" : "Assigner"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
