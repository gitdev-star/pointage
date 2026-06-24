// =====================================================
// PATH: pointage/frontend/src/components/hr/DocumentsRH.js
// =====================================================
import React, { useState } from "react";
import {
  Box, Button, Typography, Paper, Grid, Chip, CircularProgress,
  Alert, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, MenuItem, IconButton,
} from "@mui/material";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import PrintIcon from "@mui/icons-material/Print";
import VisibilityIcon from "@mui/icons-material/Visibility";
import CloseIcon from "@mui/icons-material/Close";
import ArticleIcon from "@mui/icons-material/Article";
import AssignmentIcon from "@mui/icons-material/Assignment";
import WorkIcon from "@mui/icons-material/Work";
import VerifiedIcon from "@mui/icons-material/Verified";
import hrClient from "../../api/hrClient";

function todayISO() { return new Date().toISOString().slice(0, 10); }

const DOCS = [
  {
    id: "attestation", title: "Attestation d'emploi",
    subtitle: "Attestation pour usage bancaire ou administratif",
    icon: <VerifiedIcon sx={{ fontSize: 36, color: "primary.main" }} />, color: "#e3f2fd",
    extraFields: [
      { key: "usage", label: "Usage de l'attestation", default: "Prêt bancaire BOA Tanjombato" },
      { key: "ref",   label: "Référence RH",           default: "" },
    ],
  },
  {
    id: "certificat", title: "Certificat de travail",
    subtitle: "Délivré en fin de contrat ou sur demande",
    icon: <AssignmentIcon sx={{ fontSize: 36, color: "success.main" }} />, color: "#e8f5e9",
    extraFields: [
      { key: "ref",      label: "Référence RH",   default: "" },
      { key: "date_fin", label: "Date de départ", default: todayISO(), type: "date" },
    ],
  },
  {
    id: "contrat_cdd", title: "Contrat de travail CDD 6 mois",
    subtitle: "Contrat bilingue FR/MG pour ouvriers",
    icon: <WorkIcon sx={{ fontSize: 36, color: "warning.main" }} />, color: "#fff8e1",
    extraFields: [
      { key: "salaire",       label: "Salaire de base (Ariary)", default: "FROM_EMPLOYEE:salaire" },
      { key: "date_embauche", label: "Date d'embauche",          default: "FROM_EMPLOYEE:hire_date", type: "date" },
    ],
  },
  {
    id: "evaluation_cdd", title: "Évaluation & Renouvellement CDD",
    subtitle: "Fiche d'évaluation pour décision de renouvellement",
    icon: <ArticleIcon sx={{ fontSize: 36, color: "secondary.main" }} />, color: "#f3e5f5",
    extraFields: [
      { key: "section",       label: "Section / Chaîne",  default: "" },
      { key: "date_debut",    label: "Date de début",     default: todayISO(), type: "date" },
      { key: "date_fin_eval", label: "Date de fin",       default: "",         type: "date" },
      { key: "phase", label: "Phase", default: "1er CDD 6 mois",
        options: ["Renouvellement essai","1er CDD 6 mois","2e CDD 6 mois","Confirmation CDI"] },
    ],
  },
  {
    id: "confirmation_cdi", title: "Évaluation & Confirmation CDI",
    subtitle: "Lettre de confirmation en contrat à durée indéterminée",
    icon: <VerifiedIcon sx={{ fontSize: 36, color: "success.main" }} />, color: "#e8f5e9",
    extraFields: [
      { key: "section",    label: "Section / Chaîne",     default: "" },
      { key: "date_debut", label: "Date de début CDD",    default: "FROM_EMPLOYEE:hire_date", type: "date" },
      { key: "date_fin",   label: "Date de confirmation", default: todayISO(), type: "date" },
    ],
  },
];

async function renderDocxToHtml(blob) {
  const { renderAsync } = await import("https://esm.sh/docx-preview@0.3.2");
  const container = document.createElement("div");
  await renderAsync(blob, container, null, {
    className: "docx-preview", inWrapper: false, ignoreWidth: false,
    ignoreHeight: false, ignoreFonts: false, breakPages: true, useBase64URL: true,
  });
  return container;
}

export default function DocumentsRH({ employee }) {
  const [open, setOpen]           = useState(null);   // docId for param dialog
  const [extra, setExtra]         = useState({});
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  // preview state
  const [previewOpen, setPreviewOpen]   = useState(false);
  const [previewHtml, setPreviewHtml]   = useState("");
  const [previewBlob, setPreviewBlob]   = useState(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewing, setPreviewing]     = useState(false);
  const [printing, setPrinting]         = useState(false);
  const [previewDocId, setPreviewDocId] = useState(null);

  const docDef = DOCS.find(d => d.id === open);

  const handleOpen = (doc) => {
    const defaults = {};
    doc.extraFields.forEach(f => {
      if (f.default && f.default.startsWith("FROM_EMPLOYEE:")) {
        const field = f.default.replace("FROM_EMPLOYEE:", "");
        const val = employee[field];
        defaults[f.key] = val ? String(val).slice(0, 10) : "";
      } else {
        defaults[f.key] = f.default || "";
      }
    });
    setExtra(defaults); setError(null); setOpen(doc.id);
  };

  const fetchBlob = async () => {
    const res = await hrClient.post(
      `documents/${employee.id}/${open}/`, extra, { responseType: "blob" }
    );
    return res.data;
  };

  const handlePreview = async () => {
    setPreviewing(true); setError(null);
    try {
      const blob = await fetchBlob();
      const container = await renderDocxToHtml(blob);
      setPreviewHtml(container.innerHTML);
      setPreviewBlob(blob);
      setPreviewTitle(docDef.title);
      setPreviewDocId(open);
      setOpen(null);
      setPreviewOpen(true);
    } catch (e) {
      await readError(e);
    } finally { setPreviewing(false); }
  };

  const handleDownload = async () => {
    setLoading(true); setError(null);
    try {
      const blob = previewBlob || await fetchBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(previewTitle || docDef?.title || "document").replace(/\s+/g,"_")}_${employee.last_name}_${employee.first_name}.docx`;
      a.click();
      URL.revokeObjectURL(url);
      setPreviewOpen(false);
    } catch (e) { await readError(e); }
    finally { setLoading(false); }
  };

  const handlePrint = async () => {
    setPrinting(true); setError(null);
    try {
      const docId = previewDocId || open;
      const res = await hrClient.post(
        `documents/${employee.id}/${docId}/pdf/`, extra, { responseType: "blob" }
      );
      const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const win = window.open(url, "_blank");
      if (win) win.onload = () => { win.focus(); win.print(); };
    } catch (e) { await readError(e); }
    finally { setPrinting(false); }
  };

  const readError = async (e) => {
    try {
      const text = await e.response?.data?.text();
      const json = JSON.parse(text);
      setError(json.detail || "Erreur.");
    } catch { setError("Erreur : " + e.message); }
  };

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" mb={2}>
        Cliquez sur un document pour le prévisualiser et le générer avec les données de l'employé.
      </Typography>

      <Grid container spacing={2}>
        {DOCS.map(doc => (
          <Grid item xs={12} sm={6} key={doc.id}>
            <Paper elevation={1} sx={{
              p: 2.5, cursor: "pointer", backgroundColor: doc.color,
              border: "1px solid transparent", transition: "all 0.2s",
              "&:hover": { borderColor: "primary.main", transform: "translateY(-2px)" },
            }} onClick={() => handleOpen(doc)}>
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2 }}>
                {doc.icon}
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={700} fontSize={14}>{doc.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{doc.subtitle}</Typography>
                  <Box mt={1} sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Chip label="Prévisualiser" size="small" icon={<VisibilityIcon sx={{ fontSize: 14 }} />} color="primary" variant="outlined" />
                    <Chip label="Télécharger" size="small" icon={<DownloadIcon sx={{ fontSize: 14 }} />} color="success" variant="outlined" />
                  </Box>
                </Box>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Parameters dialog ── */}
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth>
        {docDef && (<>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon color="primary" /> {docDef.title}
          </DialogTitle>
          <DialogContent>
            <Paper sx={{ p: 2, mb: 2, backgroundColor: "#f5f5f5" }} elevation={0}>
              <Typography variant="caption" color="text.secondary" display="block">Employé</Typography>
              <Typography fontWeight={700}>{employee.last_name} {employee.first_name}</Typography>
              <Typography variant="body2">{employee.job_title} — {employee.factory_name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Matricule : {employee.employee_id} | Embauche : {employee.hire_date}
              </Typography>
            </Paper>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" fontWeight={600} mb={1}>Paramètres du document</Typography>
            {docDef.extraFields.map(f => f.options ? (
              <TextField key={f.key} select fullWidth size="small" label={f.label}
                value={extra[f.key] || ""} sx={{ mb: 1.5 }}
                onChange={e => setExtra(p => ({ ...p, [f.key]: e.target.value }))}>
                {f.options.map(o => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            ) : (
              <TextField key={f.key} fullWidth size="small" label={f.label}
                type={f.type || "text"} value={extra[f.key] || ""} sx={{ mb: 1.5 }}
                onChange={e => setExtra(p => ({ ...p, [f.key]: e.target.value }))}
                InputLabelProps={f.type === "date" ? { shrink: true } : undefined} />
            ))}
            {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(null)}>Annuler</Button>
            <Button variant="outlined" startIcon={previewing ? <CircularProgress size={16} color="inherit" /> : <VisibilityIcon />}
              onClick={handlePreview} disabled={previewing}>
              {previewing ? "Chargement..." : "Prévisualiser"}
            </Button>
          </DialogActions>
        </>)}
      </Dialog>

      {/* ── Preview dialog ── */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth
        PaperProps={{ sx: { height: "90vh" } }}>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <DescriptionIcon color="primary" />
            <Typography fontWeight={700}>{previewTitle}</Typography>
            <Chip label={`${employee.last_name} ${employee.first_name}`} size="small" color="primary" variant="outlined" />
          </Box>
          <IconButton onClick={() => setPreviewOpen(false)} size="small"><CloseIcon /></IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, overflow: "auto", backgroundColor: "#e0e0e0" }}>
          <Box sx={{ maxWidth: 820, mx: "auto", my: 2, backgroundColor: "#fff",
            boxShadow: "0 2px 12px rgba(0,0,0,0.2)", borderRadius: 1 }}>
            <style>{`
              .docx-render-zone { padding: 40px 60px; font-family: Arial, sans-serif; }
              .docx-render-zone p { margin: 4px 0; line-height: 1.5; }
              .docx-render-zone table { border-collapse: collapse; width: 100%; margin: 8px 0; }
              .docx-render-zone td, .docx-render-zone th { border: 1px solid #ccc; padding: 6px 8px; }
            `}</style>
            <Box className="docx-render-zone"
              dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </Box>
        </DialogContent>

        <DialogActions sx={{ gap: 1, px: 3, py: 1.5 }}>
          <Button onClick={() => setPreviewOpen(false)} color="inherit">Fermer</Button>
          <Button variant="outlined" color="secondary"
            startIcon={printing ? <CircularProgress size={16} color="inherit" /> : <PrintIcon />}
            onClick={handlePrint} disabled={printing || loading}>
            {printing ? "Impression..." : "Imprimer"}
          </Button>
          <Button variant="contained"
            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={handleDownload} disabled={loading || printing}>
            {loading ? "Téléchargement..." : "Télécharger .docx"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
