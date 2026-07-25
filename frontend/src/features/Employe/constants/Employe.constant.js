// ── Statuts ──────────────────────────────────────────────────────────────────

export const EMPLOYEE_STATUSES = {
  ACTIVE:     { label: "Actif",     chipColor: "success", tw: { bg: "bg-green-50",  text: "text-green-800"  } },
  INACTIVE:   { label: "Inactif",   chipColor: "default", tw: { bg: "bg-gray-100",  text: "text-gray-600"   } },
  ON_LEAVE:   { label: "En congé",  chipColor: "warning", tw: { bg: "bg-amber-50",  text: "text-amber-800"  } },
  TERMINATED: { label: "Parti",     chipColor: "error",   tw: { bg: "bg-red-50",    text: "text-red-800"    } },
};

// Raccourcis pour les cas où on n'a besoin que du label ou de la couleur MUI
export const STATUS_LABELS      = Object.fromEntries(Object.entries(EMPLOYEE_STATUSES).map(([k, v]) => [k, v.label]));
export const STATUS_CHIP_COLORS = Object.fromEntries(Object.entries(EMPLOYEE_STATUSES).map(([k, v]) => [k, v.chipColor]));

// ── Types de contrat ──────────────────────────────────────────────────────────

export const CONTRACT_TYPES = {
  CDI:      { label: "CDI",          tw: { bg: "bg-blue-50",   text: "text-blue-800"  } },
  CDD:      { label: "CDD",          tw: { bg: "bg-amber-50",  text: "text-amber-800" } },
  INTERN:   { label: "Stage",        tw: { bg: "bg-purple-50", text: "text-purple-800"} },
  PART:     { label: "Temps partiel",tw: { bg: "bg-green-50",  text: "text-green-800" } },
  SEASONAL: { label: "Saisonnier",   tw: { bg: "bg-red-50",    text: "text-red-800"   } },
};

export const CONTRACT_LABELS = Object.fromEntries(Object.entries(CONTRACT_TYPES).map(([k, v]) => [k, v.label]));

// ── Congés ────────────────────────────────────────────────────────────────────

export const LEAVE_STATUS_CHIP_COLORS = {
  PENDING:   "warning",
  APPROVED:  "success",
  REJECTED:  "error",
  CANCELLED: "default",
};

// ── Sexe ──────────────────────────────────────────────────────────────────────

export const SEXE_OPTIONS = [
  { value: "Masculin", label: "Masculin" },
  { value: "Féminin",  label: "Féminin"  },
];

// ── Mois (paie) ───────────────────────────────────────────────────────────────

export const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

// ── Pagination ────────────────────────────────────────────────────────────────

export const DEFAULT_PAGE_SIZE       = 50;
export const DEFAULT_PAGE_SIZE_SMALL = 20;

// ── Formulaire vide employé ───────────────────────────────────────────────────

export const EMPTY_EMPLOYEE_FORM = {
  employee_id: "", first_name: "", last_name: "", sexe: "",
  birth_date: "", birth_place: "",
  email: "", phone: "", address: "",
  cin: "", cin_date: "", cin_place: "",
  cnaps: "", nbre_enfants: "",
  factory: "", department: "", section: "",
  job_title: "", contract_type: "CDI",
  hire_date: "", termination_date: "", status: "ACTIVE",
  motif_depart: "",
  matricule_paie: "", affectation: "", hk_ou_pbi: "",
  n_rh: "", salaire: "", classification: "",
  device_user_id: "", auth_user_id: "",
};

// ── Filtres vides ─────────────────────────────────────────────────────────────

export const EMPTY_FILTERS = {
  status: "ACTIVE",
  factory: "",
  department: "",
  contract_type: "",
  search: "",
  sexe: "",
};

// ── Colonnes export CSV ───────────────────────────────────────────────────────

export const CSV_EXPORT_HEADERS = [
  "Matricule","Nom","Prénom","Poste","Classification","Section",
  "Usine","Département","Affectation","Date embauche","CIN",
  "Sexe","CNAPS","Téléphone","Adresse","N RH","Date naissance",
  "Lieu de naissance","Date CIN","Lieu CIN","Nbre enfants", 
  "Contrat","Statut","Email",
];

/** Extrait les valeurs d'un objet employé dans l'ordre des colonnes CSV */
export const CSV_ROW_EXTRACTOR = (e) => [
  e.employee_id, e.last_name, e.first_name, e.job_title_name, e.classification_name, e.section_name || "",
  e.factory_name, e.department_name, e.affectation, e.hire_date, e.cin, 
  e.sexe, e.cnaps, e.phone, e.address, e.n_rh, e.birth_date, 
  e.birth_place, e.cin_date, e.cin_place, e.nbre_enfants, 
  e.contract_type,  e.status, e.email,  
]; 