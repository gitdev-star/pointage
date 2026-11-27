// ─── RecapEmbauchesPeriode.jsx ────────────────────────────────────────────────
// Page Employés : filtre « embauché du … au … », nombre d'embauches de la
// période et détail par site (personnes parties depuis comprises), export Excel.

import React, { useEffect, useState } from "react";
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Button, Chip,
  CircularProgress, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DownloadIcon from "@mui/icons-material/Download";
import hrClient from "../../../api/hrClient";

const formaterDate = (valeur) =>
  valeur ? new Date(`${valeur}T00:00:00`).toLocaleDateString("fr-FR") : "—";

// Mêmes filtres que la liste, sauf le statut : les personnes embauchées sur la
// période comptent même si elles sont parties depuis.
const parametresRecap = (filters, periode) => {
  const params = { embauche_du: periode.du, embauche_au: periode.au };
  ["factory", "department", "contract_type", "search", "sexe"].forEach((cle) => {
    if (filters[cle]) params[cle] = filters[cle];
  });
  return params;
};

const messageErreur = async (error) => {
  let data = error.response?.data;
  // Réponse d'erreur d'un téléchargement : le JSON arrive dans un Blob
  if (data instanceof Blob) {
    try {
      data = JSON.parse(await data.text());
    } catch {
      data = null;
    }
  }
  if (data && typeof data === "object") {
    const premier = data.detail || Object.values(data)[0];
    return Array.isArray(premier) ? premier[0] : String(premier);
  }
  return "Impossible de charger les embauches de la période.";
};

export default function RecapEmbauchesPeriode({ filters, onPeriodeChange }) {
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [periode, setPeriode] = useState(null); // { du, au } une fois appliquée
  const [recap, setRecap] = useState(null);
  const [chargement, setChargement] = useState(false);
  const [exportEnCours, setExportEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

  const { factory, department, contract_type: contrat, search, sexe } = filters;

  useEffect(() => {
    if (!periode) {
      setRecap(null);
      return undefined;
    }
    let actif = true;
    setChargement(true);
    setErreur("");
    hrClient
      .get("employees/embauches-periode/", {
        params: parametresRecap({ factory, department, contract_type: contrat, search, sexe }, periode),
      })
      .then((r) => actif && setRecap(r.data))
      .catch(async (error) => {
        if (actif) {
          setRecap(null);
          setErreur(await messageErreur(error));
        }
      })
      .finally(() => actif && setChargement(false));
    return () => {
      actif = false;
    };
  }, [periode, factory, department, contrat, search, sexe]);

  const appliquer = () => {
    if (!du || !au) {
      setErreur("Choisissez une date de début et une date de fin.");
      return;
    }
    if (du > au) {
      setErreur("La date de fin doit être après la date de début.");
      return;
    }
    const nouvelle = { du, au };
    setPeriode(nouvelle);
    onPeriodeChange?.(nouvelle);
  };

  const effacer = () => {
    setDu("");
    setAu("");
    setPeriode(null);
    setErreur("");
    onPeriodeChange?.(null);
  };

  const exporterExcel = async () => {
    setExportEnCours(true);
    setErreur("");
    try {
      const r = await hrClient.get("employees/embauches-periode-excel/", {
        params: parametresRecap(filters, periode),
        responseType: "blob",
      });
      const lien = document.createElement("a");
      lien.href = URL.createObjectURL(r.data);
      lien.download = `embauches_${periode.du}_${periode.au}.xlsx`;
      document.body.appendChild(lien);
      lien.click();
      lien.remove();
      URL.revokeObjectURL(lien.href);
    } catch (error) {
      setErreur(await messageErreur(error));
    } finally {
      setExportEnCours(false);
    }
  };

  return (
    <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-slate-700">Période d'embauche</span>
        <TextField
          type="date"
          size="small"
          label="Du"
          value={du}
          onChange={(e) => setDu(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          type="date"
          size="small"
          label="Au"
          value={au}
          onChange={(e) => setAu(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <Button size="small" variant="contained" onClick={appliquer}>
          Appliquer
        </Button>
        {periode && (
          <Button size="small" color="error" variant="outlined" onClick={effacer}>
            Effacer la période
          </Button>
        )}

        {chargement && <CircularProgress size={20} />}

        {periode && recap && !chargement && (
          <>
            <Chip
              color="primary"
              label={
                `${recap.total} personne(s) embauchée(s) du ${formaterDate(recap.embauche_du)}` +
                ` au ${formaterDate(recap.embauche_au)}` +
                (recap.partis ? ` (dont ${recap.partis} partie(s) depuis)` : "")
              }
            />
            {recap.total > 0 && (
              <Button
                size="small"
                variant="outlined"
                startIcon={exportEnCours ? <CircularProgress size={14} /> : <DownloadIcon />}
                disabled={exportEnCours}
                onClick={exporterExcel}
              >
                Exporter en Excel
              </Button>
            )}
          </>
        )}
      </div>

      {erreur && (
        <Alert severity="error" className="mt-3" onClose={() => setErreur("")}>
          {erreur}
        </Alert>
      )}

      {periode && recap && recap.total > 0 && !chargement && (
        <div className="mt-3">
          <p className="mb-2 text-xs text-slate-500">
            Détail par site. Les personnes parties depuis sont comprises.
          </p>
          {recap.sites.map((site) => (
            <Accordion key={site.site} disableGutters variant="outlined">
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <span className="font-semibold text-slate-800">{site.site}</span>
                <span className="ml-3 text-sm text-slate-500">{site.nombre} embauche(s)</span>
              </AccordionSummary>
              <AccordionDetails>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        {["Matricule", "Nom", "Prénom", "Poste", "Département",
                          "Date d'embauche", "Contrat", "Statut", "Date de départ"].map((titre) => (
                          <TableCell key={titre}><strong>{titre}</strong></TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {site.employes.map((e) => (
                        <TableRow key={e.id}>
                          <TableCell>{e.matricule}</TableCell>
                          <TableCell>{e.nom}</TableCell>
                          <TableCell>{e.prenom}</TableCell>
                          <TableCell>{e.poste || "—"}</TableCell>
                          <TableCell>{e.departement || "—"}</TableCell>
                          <TableCell>{formaterDate(e.date_embauche)}</TableCell>
                          <TableCell>{e.contrat || "—"}</TableCell>
                          <TableCell>{e.statut || "—"}</TableCell>
                          <TableCell>{formaterDate(e.date_depart)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </AccordionDetails>
            </Accordion>
          ))}
        </div>
      )}

      {periode && recap && recap.total === 0 && !chargement && (
        <p className="mt-3 text-sm text-slate-500">Aucune embauche sur cette période.</p>
      )}
    </div>
  );
}
