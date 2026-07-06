// ─── EmployeeImport.jsx ───────────────────────────────────────────────────────
// Import CSV / Excel d'employés avec drag-and-drop et rapport de résultats.

import React, { useState, useRef } from "react";
import {
  Typography, Button, Paper, Alert, LinearProgress,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Chip, Stack,
} from "@mui/material";
import UploadFileIcon    from "@mui/icons-material/UploadFile";
import DownloadIcon      from "@mui/icons-material/Download";
import CheckCircleIcon   from "@mui/icons-material/CheckCircle";
import ErrorIcon         from "@mui/icons-material/Error";
import hrClient          from "../../api/hrClient";
import { downloadCSV }   from "./utils/employee.utils";

// ─── Templates CSV ────────────────────────────────────────────────────────────

const TEMPLATE_EXCEL_HEADERS = [
  "user_id","Période de Paie embauche","Matricule","Nom","Prénoms","Emploi occupé",
  "SECTION","Intitulé établissement","Affectation","Date d'entrée poste",
  "Date de départ société","CIN","SEXE","Intitulé du motif de départ","CNAPS",
  "N° TEL","Adresse","HK ou PBI","N° RH : '0320535316 ","Date de naissance",
  "Lieu de naissance","Date CIN","Lieu CIN","NBRE ENFANTS",
  "factory_code","department_code","contract_type","status","auth_user_id",
].join(",");

const TEMPLATE_EXCEL_EXAMPLE =
  "101,2022-01,EMP001,Rakoto,Jean,Opérateur,Production,Usine Nord,Antananarivo,2022-01-15,,123456789,M,,123456789,+261320000001,Lot 123 Tana,,0320535316,1990-05-10,Antananarivo,2015-03-01,Antananarivo,2,FAC01,DEP01,CDI,ACTIVE,";

const TEMPLATE_INTERNAL =
  "employee_id,first_name,last_name,email,phone,factory_code,factory_name,factory_location,department_code,department_name,job_title,contract_type,hire_date,status,device_user_id,auth_user_id\n" +
  "EMP001,Jean,Rakoto,jean.rakoto@company.mg,+261320000001,FAC01,Usine Nord,Antananarivo,DEP01,Production,Opérateur,CDI,2022-01-15,ACTIVE,101,";

function downloadTemplate(type = "excel") {
  const content  = type === "excel"
    ? `${TEMPLATE_EXCEL_HEADERS}\n${TEMPLATE_EXCEL_EXAMPLE}`
    : TEMPLATE_INTERNAL;
  const filename = type === "excel" ? "modele_employes_excel.csv" : "modele_employes.csv";
  downloadCSV("\uFEFF" + content, filename);
}

// ─── Constantes statut ────────────────────────────────────────────────────────

const ROW_STATUS = {
  created: { label: "Créé",    color: "success" },
  skipped: { label: "Ignoré",  color: "warning" },
  error:   { label: "Erreur",  color: "error"   },
};

const ACCEPTED_TYPES = [".csv", ".xlsx"];
const isValidFile = (f) => f && ACCEPTED_TYPES.some((ext) => f.name.endsWith(ext));

// ─── Composant ────────────────────────────────────────────────────────────────

export default function EmployeeImport() {
  const [file,    setFile]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState(null);
  const [error,   setError]   = useState(null);
  const inputRef              = useRef();

  const handleFile = (f) => {
    if (isValidFile(f)) { setFile(f); setResult(null); setError(null); }
    else setError("Veuillez sélectionner un fichier .csv ou .xlsx");
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);
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
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Import Employés (CSV / Excel)</h1>

      {/* Templates */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <p className="font-semibold mb-1">Modèles</p>
        <p className="text-sm text-gray-500 mb-3">
          Téléchargez le modèle correspondant à votre source, remplissez-le et importez-le.
        </p>
        <Stack direction="row" spacing={2}>
          <Button variant="outlined" startIcon={<DownloadIcon />} onClick={() => downloadTemplate("excel")}>
            Modèle format Excel RH
          </Button>
          <Button variant="outlined" color="secondary" startIcon={<DownloadIcon />} onClick={() => downloadTemplate("internal")}>
            Modèle format interne
          </Button>
        </Stack>
      </Paper>

      {/* Zone de dépôt */}
      <Paper
        onClick={() => inputRef.current.click()}
        onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}
        onDragOver={(e) => e.preventDefault()}
        sx={{
          p: 4, mb: 3, textAlign: "center", border: "2px dashed",
          borderColor: file ? "primary.main" : "grey.300",
          backgroundColor: file ? "primary.50" : "grey.50",
          cursor: "pointer",
          transition: "all 0.15s",
        }}
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx" hidden
          onChange={(e) => handleFile(e.target.files[0])} />
        <UploadFileIcon sx={{ fontSize: 48, color: file ? "primary.main" : "grey.400", mb: 1 }} />
        {file ? (
          <p className="font-semibold text-blue-600">{file.name}</p>
        ) : (
          <>
            <p className="font-semibold text-gray-700">Glissez votre fichier CSV ou Excel ici</p>
            <p className="text-sm text-gray-400">ou cliquez pour sélectionner (.csv, .xlsx)</p>
          </>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Button
        variant="contained" size="large" fullWidth
        disabled={!file || loading} onClick={handleImport}
        sx={{ mb: 3 }}
      >
        {loading ? "Importation en cours..." : "Lancer l'importation"}
      </Button>

      {loading && <LinearProgress sx={{ mb: 3 }} />}

      {/* Résultats */}
      {result && (
        <div>
          <hr className="my-4 border-gray-200" />
          <h2 className="text-lg font-bold text-gray-900 mb-3">Résultats</h2>

          {/* Compteurs */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            {[
              { label: "Total lignes", value: result.summary.total_rows, accent: null },
              { label: "Créés",        value: result.summary.created,    accent: "border-l-4 border-green-500" },
              { label: "Ignorés",      value: result.summary.skipped,    accent: "border-l-4 border-amber-500" },
              { label: "Erreurs",      value: result.summary.errors,     accent: "border-l-4 border-red-500" },
            ].map(({ label, value, accent }) => (
              <Paper key={label} sx={{ p: 2, textAlign: "center" }} className={accent}>
                <p className="text-3xl font-bold text-gray-900">{value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{label}</p>
              </Paper>
            ))}
          </div>

          {result.summary.new_factories_created?.length > 0 && (
            <Alert severity="info" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              Nouvelles usines créées : {result.summary.new_factories_created.join(", ")}
            </Alert>
          )}
          {result.summary.new_departments_created?.length > 0 && (
            <Alert severity="info" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              Nouveaux départements créés : {result.summary.new_departments_created.join(", ")}
            </Alert>
          )}

          {/* Détail ligne par ligne */}
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
                {result.rows.map((row, i) => {
                  const s = ROW_STATUS[row.status] || { label: row.status, color: "default" };
                  return (
                    <TableRow key={i} hover>
                      <TableCell>{row.row}</TableCell>
                      <TableCell sx={{ fontFamily: "monospace" }}>{row.employee_id}</TableCell>
                      <TableCell>
                        <Chip
                          label={s.label}
                          color={s.color}
                          size="small"
                          icon={row.status === "error" ? <ErrorIcon /> : <CheckCircleIcon />}
                        />
                      </TableCell>
                      <TableCell sx={{ color: row.status === "error" ? "error.main" : "text.primary" }}>
                        {row.detail}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </div>
      )}
    </div>
  );
}
