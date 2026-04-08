import React, { useEffect, useState, useCallback } from "react";
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Chip, Button, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Alert, TablePagination, Tooltip,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import PaymentIcon from "@mui/icons-material/Payment";
import hrClient from "../../api/hrClient";
import { useHRAuth } from "../../contexts/HRAuthContext";

const STATUS_COLORS = { DRAFT: "default", VALIDATED: "warning", PAID: "success" };
const STATUS_LABELS = { DRAFT: "Brouillon", VALIDATED: "Validé", PAID: "Payé" };
const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear - i);

export default function Payroll() {
  const { can } = useHRAuth();
  const [payslips, setPayslips]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [alert, setAlert]             = useState(null);
  const [total, setTotal]             = useState(0);
  const [page, setPage]               = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [year, setYear]               = useState(currentYear);
  const [month, setMonth]             = useState("");
  const [statusFilter, setStatus]     = useState("");

  const fetchPayslips = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: page + 1, page_size: rowsPerPage };
      if (year)         params.period_year  = year;
      if (month)        params.period_month = month;
      if (statusFilter) params.status       = statusFilter;
      const res = await hrClient.get("payroll/payslips/", { params });
      setPayslips(res.data.results || res.data);
      setTotal(res.data.count || 0);
    } catch { setAlert({ type: "error", msg: "Erreur chargement des fiches de paie." }); }
    finally { setLoading(false); }
  }, [page, rowsPerPage, year, month, statusFilter]);

  useEffect(() => { fetchPayslips(); }, [fetchPayslips]);

  const handleValidate = async (id) => {
    try {
      await hrClient.post(`payroll/payslips/${id}/validate/`);
      setAlert({ type: "success", msg: "Fiche de paie validée." }); fetchPayslips();
    } catch (err) { setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." }); }
  };

  const handleMarkPaid = async (id) => {
    try {
      await hrClient.post(`payroll/payslips/${id}/mark_paid/`);
      setAlert({ type: "success", msg: "Fiche de paie marquée comme payée." }); fetchPayslips();
    } catch (err) { setAlert({ type: "error", msg: err.response?.data?.detail || "Erreur." }); }
  };

  const fmt = (n) => Number(n).toLocaleString("fr-MG") + " Ar";

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Fiches de Paie</Typography>
      {!can("payroll_validate") && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Vous avez un accès en lecture seule aux fiches de paie.
        </Alert>
      )}
      {alert && <Alert severity={alert.type} sx={{ mb: 2 }} onClose={() => setAlert(null)}>{alert.msg}</Alert>}
      <Box sx={{ display: "flex", gap: 2, mb: 3, flexWrap: "wrap" }}>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Année</InputLabel>
          <Select value={year} label="Année" onChange={e => { setYear(e.target.value); setPage(0); }}>
            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Mois</InputLabel>
          <Select value={month} label="Mois" onChange={e => { setMonth(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            {MONTHS.map((m, i) => <MenuItem key={i+1} value={i+1}>{m}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Statut</InputLabel>
          <Select value={statusFilter} label="Statut" onChange={e => { setStatus(e.target.value); setPage(0); }}>
            <MenuItem value="">Tous</MenuItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <TableContainer component={Paper} elevation={2}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell><strong>Employé</strong></TableCell>
              <TableCell><strong>Période</strong></TableCell>
              <TableCell align="right"><strong>Salaire base</strong></TableCell>
              <TableCell align="right"><strong>Primes</strong></TableCell>
              <TableCell align="right"><strong>Déductions</strong></TableCell>
              <TableCell align="right"><strong>Net</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
              {can("payroll_validate") && <TableCell><strong>Actions</strong></TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4 }}><CircularProgress size={32} /></TableCell></TableRow>
            ) : payslips.length === 0 ? (
              <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: "text.secondary" }}>Aucune fiche de paie trouvée</TableCell></TableRow>
            ) : payslips.map(p => (
              <TableRow key={p.id} hover>
                <TableCell><strong>{p.employee_name}</strong></TableCell>
                <TableCell>{MONTHS[p.period_month - 1]} {p.period_year}</TableCell>
                <TableCell align="right">{fmt(p.base_salary)}</TableCell>
                <TableCell align="right">{fmt(Number(p.allowances) + Number(p.bonuses))}</TableCell>
                <TableCell align="right" sx={{ color: "error.main" }}>-{fmt(Number(p.deductions) + Number(p.social_charges))}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: "success.main" }}>{fmt(p.net_salary)}</TableCell>
                <TableCell><Chip label={STATUS_LABELS[p.status]} color={STATUS_COLORS[p.status]} size="small" /></TableCell>
                {can("payroll_validate") && (
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {p.status === "DRAFT" && (
                        <Tooltip title="Valider">
                          <Button size="small" color="warning" variant="outlined"
                            startIcon={<CheckCircleIcon />} onClick={() => handleValidate(p.id)}>Valider</Button>
                        </Tooltip>
                      )}
                      {p.status === "VALIDATED" && (
                        <Tooltip title="Marquer comme payé">
                          <Button size="small" color="success" variant="outlined"
                            startIcon={<PaymentIcon />} onClick={() => handleMarkPaid(p.id)}>Payer</Button>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)} rowsPerPage={rowsPerPage}
        onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value)); setPage(0); }}
        rowsPerPageOptions={[10, 20, 50]} labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`} />
    </Box>
  );
}
