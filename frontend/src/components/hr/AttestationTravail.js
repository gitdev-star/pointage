import React, { useState } from "react";
import {
  Box, Button, Dialog, DialogContent, DialogActions,
  FormControlLabel, Checkbox, Typography,
} from "@mui/material";
import PrintIcon from "@mui/icons-material/Print";


function calcSeniority(hireDate) {
  if (!hireDate) return "";
  const start = new Date(hireDate);
  const now   = new Date();
  const total = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  const y = Math.floor(total / 12);
  const m = total % 12;
  return `${y} an(s) et ${m} mois`;
}

const CONTRACT_LABELS = {
  CDI: "Contrat à Durée Indéterminée (CDI)",
  CDD: "Contrat à Durée Déterminée (CDD)",
  INTERN: "Stage",
  PART: "Temps Partiel",
  SEASONAL: "Saisonnier",
};

const today = () => new Date().toLocaleDateString("fr-FR", {
  day: "numeric", month: "long", year: "numeric"
});

export default function AttestationTravail({ employee, open, onClose }) {
  const [showSalary, setShowSalary] = useState(false);
  const [salary, setSalary]         = useState(null);
  

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(generateHTML());
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const generateHTML = () => `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Attestation de Travail — ${employee?.last_name} ${employee?.first_name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 12pt;
      color: #000;
      background: #fff;
      padding: 0;
    }
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      padding: 25mm 20mm 20mm 20mm;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    .company-info { font-size: 10pt; }
    .company-name { font-size: 14pt; font-weight: bold; margin-bottom: 5px; }
    .doc-info { text-align: right; font-size: 10pt; }
    .doc-ref { font-weight: bold; }
    .title {
      text-align: center;
      font-size: 16pt;
      font-weight: bold;
      text-transform: uppercase;
      text-decoration: underline;
      margin: 40px 0 30px 0;
      letter-spacing: 2px;
    }
    .intro {
      margin-bottom: 25px;
      line-height: 1.8;
      font-size: 12pt;
    }
    .content {
      margin: 20px 0;
      line-height: 2;
    }
    .field {
      display: flex;
      margin-bottom: 8px;
    }
    .field-label {
      font-weight: bold;
      min-width: 220px;
    }
    .field-value {
      flex: 1;
      border-bottom: 1px dotted #666;
      padding-bottom: 2px;
    }
    .purpose {
      margin: 30px 0;
      line-height: 1.8;
      font-size: 12pt;
    }
    .signature {
      margin-top: 60px;
      display: flex;
      justify-content: space-between;
    }
    .sig-block { text-align: center; }
    .sig-label { font-weight: bold; margin-bottom: 60px; }
    .sig-line { border-top: 1px solid #000; width: 200px; margin: 0 auto; }
    .footer {
      position: absolute;
      bottom: 15mm;
      left: 20mm;
      right: 20mm;
      text-align: center;
      font-size: 8pt;
      color: #666;
      border-top: 1px solid #ccc;
      padding-top: 8px;
    }
    @media print {
      body { padding: 0; }
      .page { margin: 0; padding: 15mm; }
    }
  </style>
</head>
<body>
<div class="page">
  <!-- Header -->
  <div class="header">
    <div class="company-info">
      <div class="company-name">${employee?.factory_name || "SOCIÉTÉ"}</div>
      <div>${employee?.department_name || ""}</div>
    </div>
    <div class="doc-info">
      <div class="doc-ref">Réf: ATT-${employee?.employee_id}-${new Date().getFullYear()}</div>
      <div>Antananarivo, le ${today()}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="title">Attestation de Travail</div>

  <!-- Intro -->
  <div class="intro">
    Je soussigné(e), le Directeur des Ressources Humaines de <strong>${employee?.factory_name || "la société"}</strong>,
    atteste par la présente que :
  </div>

  <!-- Employee details -->
  <div class="content">
    <div class="field">
      <span class="field-label">Nom et Prénom :</span>
      <span class="field-value"><strong>${employee?.last_name?.toUpperCase()} ${employee?.first_name}</strong></span>
    </div>
    <div class="field">
      <span class="field-label">Matricule :</span>
      <span class="field-value">${employee?.employee_id}</span>
    </div>
    <div class="field">
      <span class="field-label">Poste occupé :</span>
      <span class="field-value">${employee?.job_title}</span>
    </div>
    <div class="field">
      <span class="field-label">Département :</span>
      <span class="field-value">${employee?.department_name}</span>
    </div>
    <div class="field">
      <span class="field-label">Site / Usine :</span>
      <span class="field-value">${employee?.factory_name}</span>
    </div>
    <div class="field">
      <span class="field-label">Type de contrat :</span>
      <span class="field-value">${CONTRACT_LABELS[employee?.contract_type] || employee?.contract_type}</span>
    </div>
    <div class="field">
      <span class="field-label">Date d'embauche :</span>
      <span class="field-value">${employee?.hire_date ? new Date(employee.hire_date).toLocaleDateString("fr-FR") : ""}</span>
    </div>
    <div class="field">
      <span class="field-label">Ancienneté :</span>
      <span class="field-value">${calcSeniority(employee?.hire_date)}</span>
    </div>
    ${showSalary && salary ? `
    <div class="field">
      <span class="field-label">Salaire net mensuel :</span>
      <span class="field-value">${Number(salary).toLocaleString("fr-MG")} Ariary</span>
    </div>
    ` : ""}
  </div>

  <!-- Purpose -->
  <div class="purpose">
    Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit,
    notamment pour toute démarche administrative nécessitant la preuve d'un emploi.
  </div>

  <!-- Signature -->
  <div class="signature">
    <div class="sig-block">
      <div class="sig-label">L'employé(e)</div>
      <div class="sig-line"></div>
      <div style="margin-top:5px; font-size:10pt;">${employee?.last_name} ${employee?.first_name}</div>
    </div>
    <div class="sig-block">
      <div class="sig-label">Le Directeur RH</div>
      <div class="sig-line"></div>
      <div style="margin-top:5px; font-size:10pt;">Signature et cachet</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    ${employee?.factory_name} — Document généré le ${today()} — Confidentiel
  </div>
</div>
</body>
</html>
  `;

  if (!employee) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <Box sx={{ p: 2, borderBottom: "1px solid #e0e0e0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h6" fontWeight={700}>
          📄 Attestation de Travail — {employee.last_name} {employee.first_name}
        </Typography>
      </Box>

      <DialogContent>
        {/* Options */}
        <Box sx={{ mb: 2, p: 2, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="subtitle2" fontWeight={600} mb={1}>Options :</Typography>
          <FormControlLabel
            control={<Checkbox checked={showSalary} onChange={e => setShowSalary(e.target.checked)} />}
            label="Inclure le salaire net mensuel"
          />
          {showSalary && (
            <Box sx={{ mt: 1 }}>
              <input
                type="number"
                placeholder="Salaire net (Ar)"
                style={{ padding: "8px", border: "1px solid #ccc", borderRadius: "4px", width: "200px" }}
                onChange={e => setSalary(e.target.value)}
              />
            </Box>
          )}
        </Box>

        {/* Preview */}
        <Box sx={{
          border: "1px solid #e0e0e0", borderRadius: 1, p: 3,
          backgroundColor: "#fff", minHeight: 400,
          fontFamily: "serif",
        }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", pb: 2, mb: 3 }}>
            <Box>
              <Typography fontWeight={700} fontSize={16}>{employee.factory_name}</Typography>
              <Typography fontSize={12}>{employee.department_name}</Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography fontSize={11} fontWeight={600}>Réf: ATT-{employee.employee_id}-{new Date().getFullYear()}</Typography>
              <Typography fontSize={11}>Antananarivo, le {today()}</Typography>
            </Box>
          </Box>

          <Typography variant="h6" fontWeight={700} textAlign="center" sx={{ textDecoration: "underline", mb: 3, letterSpacing: 2 }}>
            ATTESTATION DE TRAVAIL
          </Typography>

          <Typography sx={{ mb: 2, lineHeight: 1.8 }}>
            Je soussigné(e), le Directeur des Ressources Humaines de <strong>{employee.factory_name}</strong>,
            atteste par la présente que :
          </Typography>

          {[
            { label: "Nom et Prénom", value: `${employee.last_name?.toUpperCase()} ${employee.first_name}` },
            { label: "Matricule", value: employee.employee_id },
            { label: "Poste occupé", value: employee.job_title },
            { label: "Département", value: employee.department_name },
            { label: "Site / Usine", value: employee.factory_name },
            { label: "Type de contrat", value: CONTRACT_LABELS[employee.contract_type] || employee.contract_type },
            { label: "Date d'embauche", value: employee.hire_date ? new Date(employee.hire_date).toLocaleDateString("fr-FR") : "" },
            { label: "Ancienneté", value: calcSeniority(employee.hire_date) },
            ...(showSalary && salary ? [{ label: "Salaire net mensuel", value: `${Number(salary).toLocaleString("fr-MG")} Ariary` }] : []),
          ].map(({ label, value }) => (
            <Box key={label} sx={{ display: "flex", mb: 1 }}>
              <Typography fontWeight={600} sx={{ minWidth: 220, fontSize: 13 }}>{label} :</Typography>
              <Typography sx={{ borderBottom: "1px dotted #999", flex: 1, fontSize: 13 }}>{value}</Typography>
            </Box>
          ))}

          <Typography sx={{ mt: 3, lineHeight: 1.8, fontSize: 13 }}>
            Cette attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit,
            notamment pour toute démarche administrative nécessitant la preuve d'un emploi.
          </Typography>

          <Box sx={{ display: "flex", justifyContent: "space-between", mt: 5 }}>
            <Box sx={{ textAlign: "center" }}>
              <Typography fontWeight={600} fontSize={12}>L'employé(e)</Typography>
              <Box sx={{ borderTop: "1px solid #000", width: 150, mt: 5, mb: 1 }} />
              <Typography fontSize={11}>{employee.last_name} {employee.first_name}</Typography>
            </Box>
            <Box sx={{ textAlign: "center" }}>
              <Typography fontWeight={600} fontSize={12}>Le Directeur RH</Typography>
              <Box sx={{ borderTop: "1px solid #000", width: 150, mt: 5, mb: 1 }} />
              <Typography fontSize={11}>Signature et cachet</Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
        <Button onClick={onClose}>Fermer</Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={handlePrint}>
          Imprimer / Télécharger PDF
        </Button>
      </DialogActions>
    </Dialog>
  );
}
