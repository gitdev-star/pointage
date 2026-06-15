import React, { useState, useRef } from "react";
import {
  Box, Typography, Button, Paper, Alert, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Divider, Stack,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import hrClient from "../../api/hrClient";

const STATUS_COLORS = { created: "success", skipped: "warning", error: "error" };
const STATUS_LABELS = { created: "Créé", skipped: "Ignoré", error: "Erreur" };

const CSV_TEMPLATE_EXCEL = [
  "user_id",
  "Période de Paie embauche",
  "Matricule",
  "Nom",
  "Prénoms",
  "Emploi occupé",
  "SECTION",
  "Intitulé établissement",
  "Affectation",
  "Date d'entrée poste",
  "Date de départ société",
  "CIN",
  "SEXE",
  "Intitulé du motif de départ",
  "CNAPS",
  "N° TEL",
  "Adresse",
  "HK ou PBI",
  "N° RH : '0320535316 ",
  "Date de naissance",
  "Lieu de naissance",
  "Date CIN",
  "Lieu CIN",
  "NBRE ENFANTS",
  "contract_type",
  "status",
  "auth_user_id",
].join(",");

const CSV_TEMPLATE_EXAMPLE =
  "101,2022-01,EMP001,Rakoto,Jean,Opérateur,Production,Usine Nord,Antananarivo,2022-01-15,,123456789,M,,123456789,+261320000001,Lot 123 Tana,,0320535316,1990-05-10,Antananarivo,2015-03-01,Antananarivo,2,FAC01,DEP01,CDI,ACTIVE,";

const CSV_TEMPLATE = `${CSV_TEMPLATE_EXCEL}\n${CSV_TEMPLATE_EXAMPLE}`;

const CSV_TEMPLATE_INTERNAL = `employee_id,first_name,last_name,email,phone,factory_name,factory_location,department_name,job_title,contract_type,hire_date,status,device_user_id,auth_user_id\nEMP001,Jean,Rakoto,jean.rakoto@company.mg,+261320000001,FAC01,Usine Nord,Antananarivo,DEP01,Production,Opérateur,CDI,2022-01-15,ACTIVE,101,`;

function downloadTemplate(type = "excel") {
  const content = type === "excel" ? CSV_TEMPLATE : CSV_TEMPLATE_INTERNAL;
  const filename = type === "excel" ? "modele_employes_excel.csv" : "modele_employes.csv";
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const isValidFile = (f) => f && (f.name.endsWith(".csv") || f.name.endsWith(".xlsx"));

export default function EmployeeImport() {
  const [file, setFile]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null);
  const [error, setError]     = useState(null);
  const inputRef              = useRef();

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (isValidFile(f)) { setFile(f); setResult(null); setError(null); }
    else setError("Veuillez sélectionner un fichier .csv ou .xlsx");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (isValidFile(f)) { setFile(f); setResult(null); setError(null); }
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true); setError(null); setResult(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await hrClient.post("employees/import/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || "Erreur lors de l'importation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 900, mx: "auto" }}>
      <Typography variant="h5" fontWeight={700} mb={3}>Import Employés (CSV / Excel)</Typography>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography fontWeight={600} mb={0.5}>Modèles</Typography>
        <Typography variant="body2" color="text.secondary" mb={2}>
          Téléchargez le modèle correspondant à votre source de données, remplissez-le et importez-le.
        </Typography>
        <Stack direction="row" spacing={2}>
          <Button startIcon={<DownloadIcon />} variant="outlined" onClick={() => downloadTemplate("excel")}>
            Modèle format Excel RH
          </Button>
          <Button startIcon={<DownloadIcon />} variant="outlined" color="secondary" onClick={() => downloadTemplate("internal")}>
            Modèle format interne
          </Button>
        </Stack>
      </Paper>

      <Paper onDrop={handleDrop} onDragOver={e => e.preventDefault()}
        sx={{ p: 4, mb: 3, textAlign: "center", border: "2px dashed",
          borderColor: file ? "primary.main" : "grey.300",
          backgroundColor: file ? "primary.50" : "grey.50", cursor: "pointer" }}
        onClick={() => inputRef.current.click()}>
        <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden onChange={handleFileChange} />
        <UploadFileIcon sx={{ fontSize: 48, color: file ? "primary.main" : "grey.400", mb: 1 }} />
        {file
          ? <Typography color="primary.main" fontWeight={600}>{file.name}</Typography>
          : <>
              <Typography fontWeight={600}>Glissez votre fichier CSV ou Excel ici</Typography>
              <Typography variant="body2" color="text.secondary">ou cliquez pour sélectionner (.csv, .xlsx)</Typography>
            </>
        }
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button variant="contained" size="large" disabled={!file || loading} onClick={handleImport} fullWidth sx={{ mb: 3 }}>
        {loading ? "Importation en cours..." : "Lancer l'importation"}
      </Button>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {result && (
        <Box>
          <Divider sx={{ mb: 3 }} />
          <Typography variant="h6" fontWeight={700} mb={2}>Résultats</Typography>
          <Stack direction="row" spacing={2} mb={3} flexWrap="wrap">
            <Paper sx={{ p: 2, flex: 1, textAlign: "center", minWidth: 120 }}>
              <Typography variant="h4" fontWeight={700}>{result.summary.total_rows}</Typography>
              <Typography variant="body2" color="text.secondary">Total lignes</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, textAlign: "center", minWidth: 120, borderLeft: "4px solid #4caf50" }}>
              <Typography variant="h4" color="success.main" fontWeight={700}>{result.summary.created}</Typography>
              <Typography variant="body2" color="text.secondary">Créés</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, textAlign: "center", minWidth: 120, borderLeft: "4px solid #ff9800" }}>
              <Typography variant="h4" color="warning.main" fontWeight={700}>{result.summary.skipped}</Typography>
              <Typography variant="body2" color="text.secondary">Ignorés</Typography>
            </Paper>
            <Paper sx={{ p: 2, flex: 1, textAlign: "center", minWidth: 120, borderLeft: "4px solid #f44336" }}>
              <Typography variant="h4" color="error.main" fontWeight={700}>{result.summary.errors}</Typography>
              <Typography variant="body2" color="text.secondary">Erreurs</Typography>
            </Paper>
          </Stack>
          {result.summary.new_factories_created?.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
              Nouvelles usines créées : {result.summary.new_factories_created.join(", ")}
            </Alert>
          )}
          {result.summary.new_departments_created?.length > 0 && (
            <Alert severity="info" sx={{ mb: 2 }} icon={<CheckCircleIcon />}>
              Nouveaux départements créés : {result.summary.new_departments_created.join(", ")}
            </Alert>
          )}
          <TableContainer component={Paper} elevation={1}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                  <TableCell><strong>Ligne</strong></TableCell>
                  <TableCell><strong>ID Employé</strong></TableCell>
                  <TableCell><strong>Statut</strong></TableCell>
                  <TableCell><strong>Détail</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.rows.map((row, i) => (
                  <TableRow key={i} hover>
                    <TableCell>{row.row}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{row.employee_id}</TableCell>
                    <TableCell>
                      <Chip label={STATUS_LABELS[row.status] || row.status}
                        color={STATUS_COLORS[row.status] || "default"} size="small"
                        icon={row.status === "error" ? <ErrorIcon /> : <CheckCircleIcon />} />
                    </TableCell>
                    <TableCell sx={{ color: row.status === "error" ? "error.main" : "text.primary" }}>{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );
}
