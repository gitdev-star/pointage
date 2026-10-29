//==========================================================
//frontend/src/features/Employe/components/EmployeePhotoEditor.jsx
//==========================================================

import React, { useRef, useState } from "react";
import {
  Avatar, Box, CircularProgress, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Snackbar, Alert,
} from "@mui/material";
import CameraAltIcon      from "@mui/icons-material/CameraAlt";
import UploadFileIcon     from "@mui/icons-material/UploadFile";
import DeleteOutlineIcon  from "@mui/icons-material/DeleteOutline";

import hrClient from "../../../api/hrClient";
import WebcamCaptureDialog from "./WebcamCaptureDialog";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo, same limit as the form

/**
 * Avatar with in-place photo editing (photo only).
 * Props:
 *  - employee  : { id, employee_id, first_name, last_name, photo }
 *  - size      : avatar size in px
 *  - fontSize  : initials font size
 *  - canEdit   : show the edit badge (permission)
 *  - avatarSx  : extra sx for the Avatar
 *  - onUpdated : (newPhotoUrl | null) => void
 */
export default function EmployeePhotoEditor({
  employee, size = 64, fontSize = 22, canEdit = false, avatarSx = {}, onUpdated,
}) {
  const fileRef = useRef(null);
  const [anchor,     setAnchor]     = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState(null);

  const initials = `${employee.first_name?.[0] ?? ""}${employee.last_name?.[0] ?? ""}`;
  const badge    = Math.max(32, Math.round(size * 0.42));

  // file = File to upload, or null to remove the photo
  const savePhoto = async (file) => {
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("photo", file || "");
      await hrClient.patch(`employees/${employee.id}/`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { data } = await hrClient.get(`employees/${employee.id}/`);
      onUpdated?.(data.photo || null);
    } catch (e) {
      const d = e.response?.data;
      setError(
        d?.photo ? [].concat(d.photo).join(" ")
        : d?.detail || "Échec de la mise à jour de la photo."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Le fichier doit être une image."); return; }
    if (file.size > MAX_BYTES)           { setError("Image trop lourde (max 5 Mo)."); return; }
    savePhoto(file);
  };

  const handleRemove = () => {
    if (window.confirm("Supprimer la photo de cet employé ?")) savePhoto(null);
  };

  return (
    // stopPropagation: the list row navigates on click, and React events
    // from the Menu/Dialog portals would otherwise bubble up to it.
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}
    >
      <Avatar
        src={employee.photo || undefined}
        sx={{ width: size, height: size, fontSize, ...avatarSx }}
      >
        {initials}
      </Avatar>

      {saving && (
        <Box sx={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center",
          bgcolor: "rgba(255,255,255,0.65)", borderRadius: "50%",
        }}>
          <CircularProgress size={Math.round(size / 2.5)} />
        </Box>
      )}

      {canEdit && !saving && (
        <IconButton
          size="small"
          onClick={(e) => setAnchor(e.currentTarget)}
          title="Modifier la photo"
          sx={{
            position: "absolute", right: -8, bottom: -8,
            width: badge, height: badge,
            bgcolor: "primary.main", color: "#fff", boxShadow: 3,
            "&:hover": { bgcolor: "primary.dark" },
          }}
        >
          <CameraAltIcon sx={{ fontSize: Math.round(badge * 0.6) }} />
        </IconButton>
      )}

      <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleFile} />

      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => { setAnchor(null); fileRef.current?.click(); }}>
          <ListItemIcon><UploadFileIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Choisir un fichier</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); setCameraOpen(true); }}>
          <ListItemIcon><CameraAltIcon fontSize="small" /></ListItemIcon>
          <ListItemText>Prendre une photo</ListItemText>
        </MenuItem>
        {employee.photo && (
          <MenuItem onClick={() => { setAnchor(null); handleRemove(); }} sx={{ color: "error.main" }}>
            <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText>Supprimer la photo</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <WebcamCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => savePhoto(file)}
        fileName={`employee_${employee.employee_id || employee.id}.jpg`}
      />

      <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError(null)}>
        <Alert severity="error" onClose={() => setError(null)} sx={{ width: "100%" }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
}
