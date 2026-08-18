  import React, { useEffect } from "react";
  import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Avatar,
    Box,
    Typography,
    IconButton,
    Divider,
  } from "@mui/material";
  import FormHelperText from "@mui/material/FormHelperText";
  import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
  import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
  import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
  import ContactMailOutlinedIcon from "@mui/icons-material/ContactMailOutlined";
  import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";

  import { STATUS_LABELS, SEXE_OPTIONS, CONTRACT_LABELS } from "../constants/Employe.constant";

  /* ── Helpers ─────────────────────────────────────────── */

  function Row({ children, cols }) {
    return (
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: cols || `repeat(${React.Children.count(children)}, 1fr)`,
          gap: "12px",
        }}
      >
        {children}
      </Box>
    );
  }


  function Section({ icon, label, children }) {
    return (
      <Box sx={{ mb: 3 }}>
        <Box display="flex" alignItems="center" gap={1} sx={{ mb: 1.5 }}>
          <Box sx={{ color: "text.secondary", display: "flex", fontSize: 16 }}>{icon}</Box>
          <Typography
            sx={{
              fontSize: "0.68rem",
              fontWeight: 700,
              letterSpacing: "0.09em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            {label}
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>
        <Box sx={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {children}
        </Box>
      </Box>
    );
  }

  // function Field({ label, children }) {
  //   return (
  //     <Box sx={{ display: "flex", flexDirection: "column" }}>
  //       {children}
  //     </Box>
  //   );
  // }

  const inputSx = { borderRadius: "8px" };
  const sm = { size: "small" };

  /* ── Main ────────────────────────────────────────────── */

  export default function EmployeeModal({
    open,
    onClose,
    modalMode,
    formData,
    formErrors,
    handleFormChange,
    handleSave,
    saving,
    factories,
    filteredModalDepts,
    filteredSections,
    photoPreview,
    setPhotoFile,
    setPhotoPreview,
    classifications, postes
  }) {
    useEffect(() => {
      return () => {
        if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      };
    }, [photoPreview]);

    const handlePhotoChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
        setPhotoFile(file);
        setPhotoPreview(URL.createObjectURL(file));
      }
    };

    const handleRemovePhoto = () => {
      if (photoPreview?.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      setPhotoFile(null);
      setPhotoPreview(null);
    };

    const initials = (formData.first_name?.[0] ?? "") + (formData.last_name?.[0] ?? "");
    return (
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: "14px" } }}
      >
        {/* Header */}
        <DialogTitle
          sx={{
            fontSize: "1rem",
            fontWeight: 600,
            borderBottom: "1px solid",
            borderColor: "divider",
            py: 2,
            px: 3,
          }}
        >
          {modalMode === "add" ? "Ajouter un employé" : "Modifier l'employé"}
        </DialogTitle>

        <DialogContent sx={{ px: 3, pt: 3, pb: 1 }}>

          {/* Photo */}
          <Box
            display="flex"
            alignItems="center"
            gap={2}
            sx={{
              p: 2,
              mb: 3,
              borderRadius: "10px",
              bgcolor: "grey.50",
              border: "1px solid",
              borderColor: "divider",
            }}
          >
            <Avatar
              src={photoPreview}
              sx={{
                width: 64,
                height: 64,
                fontSize: "1.2rem",
                fontWeight: 600,
                flexShrink: 0,
                border: "2px solid white",
                boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
              }}
            >
              {!photoPreview && initials}
            </Avatar>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 0.75 }}>
                Photo de profil
              </Typography>
              <Box display="flex" alignItems="center" gap={0.5}>
                <Button
                  component="label"
                  variant="outlined"
                  size="small"
                  startIcon={<PhotoCameraIcon sx={{ fontSize: "14px !important" }} />}
                  sx={{
                    textTransform: "none",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    py: 0.5,
                  }}
                >
                  {photoPreview ? "Changer" : "Ajouter"}
                  <input type="file" hidden accept="image/*" onChange={handlePhotoChange}/>
                </Button>
                {photoPreview && (
                  <IconButton onClick={handleRemovePhoto} color="error" size="small">
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                JPG, PNG • Max 5 Mo
              </Typography>
            </Box>
          </Box>

          {/* ── Identité ── */}
          <Section icon={<BadgeOutlinedIcon fontSize="inherit" />} label="Identité">
            <Row>
              <TextField
                {...sm}
                label="ID employé"
                value={
                  modalMode === "add"
                    ? "Généré automatiquement"
                    : formData.employee_id || ""
                }
                disabled
                InputProps={{ sx: inputSx }}
              />
              <TextField
                {...sm}
                label="Prénom *"
                value={formData.first_name || ""}
                onChange={(e) => handleFormChange("first_name", e.target.value)}
                error={!!formErrors.first_name}
                helperText={formErrors.first_name}
                InputProps={{ sx: inputSx }}
                required
              />
              <TextField
                {...sm}
                label="Nom *"
                value={formData.last_name || ""}
                onChange={(e) => handleFormChange("last_name", e.target.value)}
                error={!!formErrors.last_name}
                helperText={formErrors.last_name}
                InputProps={{ sx: inputSx }}
                required
              />
            </Row>
            <Row>
              <FormControl {...sm}>
                <InputLabel>Sexe</InputLabel>
                <Select
                  value={formData.sexe || ""}
                  label="Sexe"
                  onChange={(e) => handleFormChange("sexe", e.target.value)}
                  sx={inputSx}
                >
                  <MenuItem value="">—</MenuItem>
                  {SEXE_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                {...sm}
                label="Date de naissance"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.birth_date || ""}
                onChange={(e) => handleFormChange("birth_date", e.target.value)}
                InputProps={{ sx: inputSx }}
                required
              />
              <TextField
                {...sm}
                label="Lieu de naissance"
                value={formData.birth_place || ""}
                onChange={(e) => handleFormChange("birth_place", e.target.value)}
                InputProps={{ sx: inputSx }}
              />
              <TextField
                {...sm}
                label="Nombre d'enfants"
                type="number"
                value={formData.nbre_enfants || ""}
                onChange={(e) => handleFormChange("nbre_enfants", e.target.value)}
                InputProps={{ sx: inputSx }}
              />
            </Row>
          </Section>

          {/* ── Contact ── */}
          <Section icon={<ContactMailOutlinedIcon fontSize="inherit" />} label="Contact">
            <Row cols="1fr 1fr">
              <TextField
                {...sm}
                label="Email"
                type="email"
                value={formData.email || ""}
                onChange={(e) => handleFormChange("email", e.target.value)}
                error={!!formErrors.email}
                helperText={formErrors.email}
                InputProps={{ sx: inputSx }}
              />
              <TextField
                {...sm}
                label="Téléphone"
                value={formData.phone || ""}
                onChange={(e) => handleFormChange("phone", e.target.value)}
                InputProps={{ sx: inputSx }}
              />
            </Row>
            <TextField
              {...sm}
              label="Adresse complète"
              multiline
              rows={2}
              value={formData.address || ""}
              onChange={(e) => handleFormChange("address", e.target.value)}
              InputProps={{ sx: inputSx }}
              required
            />
              <TextField
                {...sm}
                label="CIN"
                value={formData.cin || ""}
                onChange={(e) => handleFormChange("cin", e.target.value)}
                InputProps={{ sx: inputSx }}
                error={!!formErrors.cin}
                helperText={formErrors.cin}
                required
              />
              <Row cols="1fr 1fr">
                <TextField
                  {...sm}
                  label="Date de délivrance CIN"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.cin_date || ""}
                  onChange={(e) => handleFormChange("cin_date", e.target.value)}
                  error={!!formErrors.cin_date}
                  helperText={formErrors.cin_date}
                  InputProps={{ sx: inputSx }}
                />
                <TextField
                  {...sm}
                  label="Lieu de délivrance CIN"
                  value={formData.cin_place || ""}
                  onChange={(e) => handleFormChange("cin_place", e.target.value)}
                  error={!!formErrors.cin_place}
                  helperText={formErrors.cin_place}
                  InputProps={{ sx: inputSx }}
                />
              </Row>
          </Section>

          {/* ── Organisation & Emploi ── */}
          <Section icon={<BusinessOutlinedIcon fontSize="inherit" />} label="Organisation & Emploi">
            <Row>
              <FormControl {...sm}>
                <InputLabel>Usine *</InputLabel>
                <Select
                  value={formData.factory || ""}
                  label="Usine *"
                  onChange={(e) => handleFormChange("factory", e.target.value)}
                  sx={inputSx}
                >
                  {factories.map((f) => (
                    <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
                  ))}
                </Select>
                {formErrors.factory && (
                  <FormHelperText>{formErrors.factory}</FormHelperText>
                )}
              </FormControl>
              <FormControl {...sm}>
                <InputLabel>Département *</InputLabel>
                <Select
                  value={formData.department || ""}
                  label="Département *"
                  onChange={(e) => handleFormChange("department", e.target.value)}
                  sx={inputSx}
                >
                  {filteredModalDepts.map((d) => (
                    <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>
                  ))}
                </Select>
                  {formErrors.department && (
      <FormHelperText>{formErrors.department}</FormHelperText>
    )}
              </FormControl>
              <FormControl {...sm}>
                <InputLabel>Section</InputLabel>
                <Select
                  value={formData.section || ""}
                  label="Section"
                  onChange={(e) => handleFormChange("section", e.target.value)}
                  sx={inputSx}
                >
                  <MenuItem value="">— Aucune —</MenuItem>
                  {filteredSections.map((s) => (
                    <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Row>
            <Row cols="1fr 1fr">
              {/* <TextField
                {...sm}
                label="Poste *"
                value={formData.job_title || ""}
                onChange={(e) => handleFormChange("job_title", e.target.value)}
                InputProps={{ sx: inputSx }}
              /> */}
  <FormControl {...sm} required>
    <InputLabel>Poste *</InputLabel>
    <Select
      value={formData.job_title || ""}
      label="Poste *"
      onChange={(e) => handleFormChange("job_title", e.target.value)}
      sx={inputSx}
    >
      {(postes || []).map((p) => (
        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
      ))}
    </Select>
    {formErrors.job_title && (
      <FormHelperText error>{formErrors.job_title}</FormHelperText>
    )}
  </FormControl>
            <FormControl {...sm}>
              <InputLabel>Classification</InputLabel>
              
              <Select
                value={formData.classification || ""}
                label="Classification"
                onChange={(e) => {
                  const selectedId = e.target.value;
                  handleFormChange("classification", selectedId);
                  const match = (classifications || []).find(
                    (c) => c.id_classification === selectedId
                  );
                  if (match) {
                    handleFormChange("salaire", match.salaire);
                  }
                }}
                sx={inputSx}
              >
                {/* <MenuItem value="">— Aucune —</MenuItem> */}
                {(classifications || []).map((c) => (
                  <MenuItem key={c.id_classification} value={c.id_classification}>
                    {c.classe}
                  </MenuItem>
                ))}
              </Select>
              {formErrors.classification && (
                <FormHelperText error>{formErrors.classification}</FormHelperText>
              )}
            </FormControl>
            <TextField
              {...sm}
              label="Salaire"
              value={formData.salaire || ""}
              onChange={(e) => handleFormChange("salaire", e.target.value)}
              InputProps={{ sx: inputSx }}
            />
              <FormControl {...sm}>
                <InputLabel>Type de contrat</InputLabel>
                <Select
                  value={formData.contract_type || ""}
                  label="Type de contrat"
                  onChange={(e) => handleFormChange("contract_type", e.target.value)}
                  sx={inputSx}
                >
                  {Object.entries(CONTRACT_LABELS).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
  		<TextField
                  {...sm}
                  label="CNAPS"
                  value={formData.cnaps || ""}
                  onChange={(e) => handleFormChange("cnaps", e.target.value)}
                  InputProps={{ sx: inputSx }}
                />
            </Row>
            <Row>
                <TextField
                {...sm}
                label="Numéro RH"
                value={formData.n_rh || ""}
                onChange={(e) => handleFormChange("n_rh", e.target.value)}
                InputProps={{ sx: inputSx }}
              />
              <TextField
                {...sm}
                label="Date d'embauche"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.hire_date || ""}
                onChange={(e) => handleFormChange("hire_date", e.target.value)}
                InputProps={{ sx: inputSx }}
                required
              />
              <TextField
                {...sm}
                label="Fin de contrat"
                type="date"
                InputLabelProps={{ shrink: true }}
                value={formData.termination_date || ""}
                onChange={(e) => handleFormChange("termination_date", e.target.value)}
                InputProps={{ sx: inputSx }}
                required
              />
              <FormControl {...sm}>
                <InputLabel>Statut</InputLabel>
                <Select
                  value={formData.status || ""}
                  label="Statut"
                  onChange={(e) => handleFormChange("status", e.target.value)}
                  sx={inputSx}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <MenuItem key={k} value={k}>{v}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Row>
          </Section>

        </DialogContent>

        {/* Footer */}
        <DialogActions
          sx={{
            px: 3,
            py: 2,
            borderTop: "1px solid",
            borderColor: "divider",
            gap: 1,
          }}
        >
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{ textTransform: "none", borderRadius: "8px" }}
          >
            Annuler
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ textTransform: "none", borderRadius: "8px", px: 3 }}
          >
            {saving ? "Sauvegarde…" : modalMode === "add" ? "Créer l'employé" : "Enregistrer"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  }
