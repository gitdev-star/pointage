//==========================================================
//frontend/src/features/Employe/components/EmployeePhotoEditor.jsx
//==========================================================

import React, { useState } from "react";
import { Avatar, Box, IconButton } from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";

import hrClient from "../../../api/hrClient";
import PhotoViewerDialog from "./PhotoViewerDialog";

/**
 * Avatar that opens a large viewer on click.
 * Inside the viewer, users with canEdit can insert / change / delete the photo
 * (saved immediately, photo field only).
 * Props:
 *  - employee  : { id, employee_id, first_name, last_name, photo }
 *  - size, fontSize, avatarSx : avatar look
 *  - canEdit   : permission to edit (employees_write)
 *  - onUpdated : (newPhotoUrl | null) => void
 */
export default function EmployeePhotoEditor({
  employee, size = 64, fontSize = 22, canEdit = false, avatarSx = {}, onUpdated,
}) {
  const [open,   setOpen]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  const initials  = `${employee.first_name?.[0] ?? ""}${employee.last_name?.[0] ?? ""}`;
  const fullName  = `${employee.last_name ?? ""} ${employee.first_name ?? ""}`.trim();
  const badge     = Math.max(32, Math.round(size * 0.42));
  const clickable = canEdit || !!employee.photo;

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

  const handleClose = () => { setOpen(false); setError(null); };

  return (
    // stopPropagation: the list row navigates on click, and React events
    // from the viewer's portal would otherwise bubble up to it.
    <Box
      onClick={(e) => e.stopPropagation()}
      sx={{ position: "relative", display: "inline-block", width: size, height: size, flexShrink: 0 }}
    >
      <Avatar
        src={employee.photo || undefined}
        onClick={clickable ? () => setOpen(true) : undefined}
        title={canEdit ? "Voir / modifier la photo" : employee.photo ? "Voir la photo" : undefined}
        sx={{
          width: size, height: size, fontSize,
          cursor: clickable ? "pointer" : "default",
          "&:hover": clickable ? { opacity: 0.85 } : undefined,
          ...avatarSx,
        }}
      >
        {initials}
      </Avatar>

      {canEdit && (
        <IconButton
          size="small"
          onClick={() => setOpen(true)}
          title="Voir / modifier la photo"
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

      <PhotoViewerDialog
        open={open}
        onClose={handleClose}
        src={employee.photo}
        title={fullName || "Photo"}
        initials={initials}
        canEdit={canEdit}
        busy={saving}
        error={error}
        onFileSelected={savePhoto}
        onRemove={() => savePhoto(null)}
        fileName={`employee_${employee.employee_id || employee.id}.jpg`}
      />
    </Box>
  );
}
