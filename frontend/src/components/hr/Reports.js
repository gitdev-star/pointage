import React, { useEffect, useState } from "react";
import {
  Box, Typography, Paper, Grid, CircularProgress,
  Alert, FormControl, InputLabel, Select, MenuItem, Tabs, Tab,
} from "@mui/material";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import hrClient from "../../api/hrClient";

const COLORS = ["#1976d2","#4caf50","#ff9800","#f44336","#9c27b0","#00bcd4","#795548"];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 4 }, (_, i) => currentYear - i);
const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export default function Reports() {
  const [tab, setTab]             = useState(0);
  const [headcount, setHeadcount] = useState(null);
  const [leaves, setLeaves]       = useState(null);
  const [payroll, setPayroll]     = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [year, setYear]           = useState(currentYear);

  useEffect(() => {
    setLoading(true); setError(null);
    Promise.all([
      hrClient.get("reports/headcount/"),
      hrClient.get("reports/leaves/",  { params: { year } }),
      hrClient.get("reports/payroll/", { params: { year } }),
    ])
      .then(([hc, lv, py]) => { setHeadcount(hc.data); setLeaves(lv.data); setPayroll(py.data); })
      .catch(() => setError("Erreur chargement des rapports."))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 8 }}><CircularProgress /></Box>;
  if (error)   return <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Rapports RH</Typography>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Année</InputLabel>
          <Select value={year} label="Année" onChange={e => setYear(e.target.value)}>
            {YEARS.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="Effectifs" /><Tab label="Congés" /><Tab label="Paie" />
      </Tabs>
      {tab === 0 && headcount && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, textAlign: "center", display: "inline-block", minWidth: 200 }}>
              <Typography variant="h3" color="primary.main" fontWeight={700}>{headcount.total_active}</Typography>
              <Typography color="text.secondary">Employés actifs</Typography>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={2}>Effectif par usine</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={headcount.by_factory}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="code" /><YAxis />
                  <Tooltip formatter={v => [v, "Actifs"]} />
                  <Bar dataKey="active_count" fill="#1976d2" radius={[4,4,0,0]} name="Actifs" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={2}>Par type de contrat</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={headcount.by_contract_type} dataKey="count" nameKey="contract_type"
                    cx="50%" cy="50%" outerRadius={90}
                    label={({ contract_type, count }) => `${contract_type}: ${count}`}>
                    {headcount.by_contract_type?.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Legend /><Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
      {tab === 1 && leaves && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={2}>Congés par type</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leaves.by_leave_type}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="leave_type__code" /><YAxis /><Tooltip />
                  <Bar dataKey="request_count" fill="#4caf50" radius={[4,4,0,0]} name="Demandes" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={2}>Congés par département</Typography>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={leaves.by_department} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" /><XAxis type="number" />
                  <YAxis dataKey="employee__department__name" type="category" width={120} /><Tooltip />
                  <Bar dataKey="request_count" fill="#ff9800" radius={[0,4,4,0]} name="Demandes" />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
      {tab === 2 && payroll && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography fontWeight={600} mb={2}>Masse salariale mensuelle {year}</Typography>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={payroll.monthly_payroll?.map(m => ({ ...m, mois: MONTHS_SHORT[m.period_month - 1], total_net: Number(m.total_net) }))}>
                  <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mois" />
                  <YAxis tickFormatter={v => (v/1000000).toFixed(1) + "M"} />
                  <Tooltip formatter={v => [Number(v).toLocaleString("fr-MG") + " Ar", "Net total"]} />
                  <Line type="monotone" dataKey="total_net" stroke="#1976d2" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
