//==========================================================
//frontend/src/features/Employe/components/PhotoViewerDialog.jsx
//==========================================================

import React, { useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, IconButton, Avatar, Box, Alert, Typography, CircularProgress,
} from "@mui/material";
import CloseIcon          from "@mui/icons-material/Close";
import UploadFileIcon     from "@mui/icons-material/UploadFile";
import CameraAltIcon      from "@mui/icons-material/CameraAlt";
import DeleteOutlineIcon  from "@mui/icons-material/DeleteOutline";
import ZoomInIcon         from "@mui/icons-material/ZoomIn";
import ZoomOutIcon        from "@mui/icons-material/ZoomOut";
import FullscreenIcon     from "@mui/icons-material/Fullscreen";
import FullscreenExitIcon from "@mui/icons-material/FullscreenExit";

import WebcamCaptureDialog from "./WebcamCaptureDialog";

const MAX_BYTES = 5 * 1024 * 1024; // 5 Mo
const MIN_ZOOM  = 1;
const MAX_ZOOM  = 5;
const ZOOM_STEP = 0.5;

// Props: open, onClose, src, title, initials, canEdit, busy, error, note,
//        onFileSelected(File), onRemove(), fileName
export default function PhotoViewerDialog({
  open, onClose, src, title = "Photo", initials = "",
  canEdit = false, busy = false, error = null, note = null,
  onFileSelected, onRemove, fileName = "employee_photo.jpg",
}) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [localError, setLocalError] = useState(null);

  // zoom / pan state
  const [zoom,       setZoom]       = useState(1);
  const [offset,     setOffset]     = useState({ x: 0, y: 0 });
  const [dragging,   setDragging]   = useState(false);
  const [fullScreen, setFullScreen] = useState(false);
  const stageRef = useRef(null);
  const dragRef  = useRef(null);
  const movedRef = useRef(false);

  // back to 100% whenever the viewer opens or the photo changes
  useEffect(() => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  }, [open, src]);

  // keep the image inside the stage when panning
  const clampOffset = (x, y, z) => {
    const el = stageRef.current;
    if (!el || z <= 1) return { x: 0, y: 0 };
    const maxX = (el.clientWidth  * (z - 1)) / 2;
    const maxY = (el.clientHeight * (z - 1)) / 2;
    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  };

  const changeZoom = (z) => {
    const nz = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));
    setZoom(nz);
    setOffset((o) => clampOffset(o.x, o.y, nz));
  };

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (e) => changeZoom(zoom + (e.deltaY < 0 ? 0.3 : -0.3));

  const onPointerDown = (e) => {
    if (zoom <= 1) return;
    dragRef.current  = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y };
    movedRef.current = false;
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true;
    setOffset(clampOffset(d.ox + dx, d.oy + dy, zoom));
  };

  const endDrag = () => {
    dragRef.current = null;
    setDragging(false);
  };

  // click = quick zoom in / reset (ignored when it was a drag)
  const onStageClick = () => {
    if (movedRef.current) { movedRef.current = false; return; }
    if (zoom > 1) resetView();
    else changeZoom(2.5);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows re-selecting the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) { setLocalError("Le fichier doit être une image."); return; }
    if (file.size > MAX_BYTES)           { setLocalError("Image trop lourde (max 5 Mo)."); return; }
    setLocalError(null);
    onFileSelected?.(file);
  };

  const handleRemove = () => {
    if (window.confirm("Supprimer la photo ?")) {
      setLocalError(null);
      onRemove?.();
    }
  };

  const handleClose = () => {
    setLocalError(null);
    setFullScreen(false);
    onClose?.();
  };

  const shownError = error || localError;

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : handleClose}
      maxWidth={src ? "lg" : "sm"}
      fullWidth
      fullScreen={fullScreen}
    >
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pr: 1 }}>
        <span>{title}</span>
        <IconButton onClick={handleClose} disabled={busy} size="small"><CloseIcon /></IconButton>
      </DialogTitle>

      <DialogContent
        dividers
        sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, py: 2 }}
      >
        {shownError && <Alert severity="error" sx={{ width: "100%" }}>{shownError}</Alert>}

        {src ? (
          <>
            {/* zoom toolbar */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <IconButton size="small" title="Zoom -" disabled={zoom <= MIN_ZOOM}
                onClick={() => changeZoom(zoom - ZOOM_STEP)}>
                <ZoomOutIcon />
              </IconButton>
              <Button size="small" onClick={resetView} title="Revenir à 100%" sx={{ minWidth: 64 }}>
                {Math.round(zoom * 100)}%
              </Button>
              <IconButton size="small" title="Zoom +" disabled={zoom >= MAX_ZOOM}
                onClick={() => changeZoom(zoom + ZOOM_STEP)}>
                <ZoomInIcon />
              </IconButton>
              <IconButton size="small" title={fullScreen ? "Quitter le plein écran" : "Plein écran"}
                onClick={() => setFullScreen((v) => !v)}>
                {fullScreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
              </IconButton>
            </Box>

            {/* photo stage */}
            <Box
              ref={stageRef}
              onWheel={handleWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onClick={onStageClick}
              sx={{
                position: "relative", width: "100%",
                height: fullScreen ? "calc(100vh - 260px)" : "65vh",
                bgcolor: "grey.900", borderRadius: 1, overflow: "hidden",
                cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "zoom-in",
                touchAction: "none", userSelect: "none",
              }}
            >
              <img
                src={src}
                alt={title}
                draggable={false}
                style={{
                  width: "100%", height: "100%", objectFit: "contain",
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transition: dragging ? "none" : "transform 0.15s ease-out",
                  pointerEvents: "none",
                }}
              />
              {busy && (
                <Box sx={{
                  position: "absolute", inset: 0, display: "flex",
                  alignItems: "center", justifyContent: "center",
                  bgcolor: "rgba(0,0,0,0.45)",
                }}>
                  <CircularProgress />
                </Box>
              )}
            </Box>

            <Typography variant="caption" color="text.secondary">
              Molette ou clic pour zoomer · glisser pour déplacer
            </Typography>
          </>
        ) : (
          <Box sx={{ position: "relative", textAlign: "center", py: 2 }}>
            <Avatar sx={{ width: 180, height: 180, fontSize: 64, mx: "auto" }}>{initials}</Avatar>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              Aucune photo
            </Typography>
            {busy && (
              <Box sx={{
                position: "absolute", inset: 0, display: "flex",
                alignItems: "center", justifyContent: "center",
                bgcolor: "rgba(255,255,255,0.6)",
              }}>
                <CircularProgress />
              </Box>
            )}
          </Box>
        )}

        {note && canEdit && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
            {note}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1 }}>
        {canEdit && (
          <>
            <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} disabled={busy}>
              {src ? "Changer (fichier)" : "Insérer (fichier)"}
              <input type="file" accept="image/*" hidden onChange={handleFile} />
            </Button>
            <Button variant="outlined" startIcon={<CameraAltIcon />} disabled={busy}
              onClick={() => setCameraOpen(true)}>
              Prendre une photo
            </Button>
            {src && (
              <Button color="error" variant="outlined" startIcon={<DeleteOutlineIcon />}
                disabled={busy} onClick={handleRemove}>
                Supprimer
              </Button>
            )}
          </>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={handleClose} disabled={busy}>Fermer</Button>
      </DialogActions>

      <WebcamCaptureDialog
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => { setLocalError(null); onFileSelected?.(file); }}
        fileName={fileName}
      />
    </Dialog>
  );
}
