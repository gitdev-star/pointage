  import { CSV_EXPORT_HEADERS, CSV_ROW_EXTRACTOR } from "../constants/Employe.constant";

  // ── Ancienneté ────────────────────────────────────────────────────────────────

  /**
   * Calcule l'ancienneté entre deux dates.
   * @param {string|null} hireDate  - Date d'embauche (ISO)
   * @param {string|null} endDate   - Date de fin (ISO), null = aujourd'hui
   * @returns {string} ex: "3 an(s) 5 mois"
   */
  export function calcSeniority(hireDate, endDate = null) {
    if (!hireDate) return "—";
    const start      = new Date(hireDate);
    const end        = endDate ? new Date(endDate) : new Date();
    const totalMonths =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth()    - start.getMonth());
    const years  = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return `${years} an(s) ${months} mois`;
  }

  // ── Retraite ──────────────────────────────────────────────────────────────────

  /** Âge légal de retraite (Madagascar) */
  const RETIREMENT_AGE = 60;

  /**
   * Calcule la date estimée de retraite à partir de la date de naissance.
   * @param {string|null} birthDate - Date de naissance (ISO)
   * @returns {string} Date formatée fr-MG ou "—"
   */
  export function calcRetirementDate(birthDate) {
    if (!birthDate) return "—";
    const d = new Date(birthDate);
    d.setFullYear(d.getFullYear() + RETIREMENT_AGE);
    return d.toLocaleDateString("fr-MG");
  }

  // ── Export CSV ────────────────────────────────────────────────────────────────

  /**
   * Convertit un tableau d'objets employé en contenu CSV (string).
   * Inclut le BOM UTF-8 pour compatibilité Excel.
   * Utilise ";" comme séparateur (standard fr).
   * @param {object[]} rows - Tableau d'employés
   * @returns {string} Contenu du fichier CSV
   */
  export function buildCSVContent(rows) {
    const escape = (v) => '"' + (v ?? "").toString().replace(/"/g, '""') + '"';

    const headerLine = "\uFEFF" + CSV_EXPORT_HEADERS.join(";");
    const dataLines  = rows.map((e) => CSV_ROW_EXTRACTOR(e).map(escape).join(";"));

    return [headerLine, ...dataLines].join("\n");
  }

  /**
   * Déclenche le téléchargement d'un fichier CSV dans le navigateur.
   * @param {string} content  - Contenu CSV
   * @param {string} filename - Nom du fichier (sans chemin)
   */
  export function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Génère un nom de fichier horodaté pour l'export.
   * @param {string} prefix - ex: "employes", "registre_personnel"
   * @returns {string} ex: "employes_2025-06-01.csv"
   */
  export function csvFilename(prefix) {
    return `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  }

  // ── Validation formulaire ─────────────────────────────────────────────────────

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  /**
   * Valide les champs obligatoires d'un formulaire employé.
   * @param {object} formData
   * @returns {{ [field: string]: string }} Objet erreurs (vide = valide)
   */
  export function validateEmployeeForm(formData) {
    const errors = {};
    if (!formData.employee_id?.trim()) errors.employee_id = "Requis";
    if (!formData.first_name?.trim())  errors.first_name  = "Requis";
    if (!formData.last_name?.trim())   errors.last_name   = "Requis";
    if (!formData.factory)             errors.factory     = "Requis";
    if (!formData.department)          errors.department  = "Requis";
    if (!formData.job_title)   errors.job_title   = "Requis";
    if (!formData.hire_date)           errors.hire_date   = "Requis";
    if (formData.email && !EMAIL_REGEX.test(formData.email))
      errors.email = "Email invalide";
    return errors;
  }

  // ── Filtres ───────────────────────────────────────────────────────────────────

  /**
   * Construit l'objet params API à partir des filtres UI.
   * Ignore les valeurs vides pour ne pas polluer la query string.
   * @param {object} filters
   * @param {number} page   - Page courante (0-indexé côté React)
   * @param {number} pageSize
   * @returns {object} Paramètres prêts pour hrClient.get()
   */
  export function buildApiParams(filters, page = 0, pageSize = 50) {
    const params = { page: page + 1, page_size: pageSize };
    if (filters.status)        params.status        = filters.status;
    if (filters.factory)       params.factory       = filters.factory;
    if (filters.department)    params.department    = filters.department;
    if (filters.contract_type) params.contract_type = filters.contract_type;
    if (filters.search)        params.search        = filters.search;
    if (filters.sexe)          params.sexe          = filters.sexe;
    return params;
  }

  /**
   * Détermine si des filtres actifs (non-défauts) sont présents.
   * Le filtre status="ACTIVE" est considéré comme le défaut, donc pas "actif".
   */
  export function hasActiveFilters(filters) {
    return Object.entries(filters).some(
      ([k, v]) => v && !(k === "status" && v === "ACTIVE")
    );
  }