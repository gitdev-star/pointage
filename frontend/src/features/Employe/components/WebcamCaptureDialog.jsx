//==========================================================
//frontend/src/features/Employe/components/WebcamCaptureDialog.jsx
//==========================================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Select, MenuItem, Alert, Box, CircularProgress,
} from "@mui/material";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import ReplayIcon    from "@mui/icons-material/Replay";

/**
 * Props:
 *  - open      : boolean
 *  - onClose   : () => void
 *  - onCapture : (file: File) => void   // JPEG File, ready to append to FormData("photo")
 *  - fileName  : string (optional)
 */
export default function WebcamCaptureDialog({
  open, onClose, onCapture, fileName = "employee_photo.jpg",
}) {
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [devices,  setDevices]  = useState([]);
  const [deviceId, setDeviceId] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [snapshot, setSnapshot] = useState(null); // { blob, url }

  // Callback ref: attaches the stream even if the <video> mounts after the stream starts
  const setVideoRef = useCallback((node) => {
    videoRef.current = node;
    if (node && streamRef.current) node.srcObject = streamRef.current;
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(async (id) => {
    stopStream();
    setError(null);
    setLoading(true);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera unavailable: the page must be served over HTTPS (or localhost).");
      setLoading(false);
      return;
    }

    try {
      const constraints = {
        audio: false,
        video: id
          ? { deviceId: { exact: id } }
          : { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;

      // Labels are only available after permission is granted
      const list = await navigator.mediaDevices.enumerateDevices();
      setDevices(list.filter((d) => d.kind === "videoinput"));
      const active = stream.getVideoTracks()[0]?.getSettings()?.deviceId;
      if (active) setDeviceId(active);
    } catch (e) {
      const map = {
        NotAllowedError:  "Camera access denied. Allow the camera in the browser (padlock icon in the address bar).",
        NotFoundError:    "No camera detected on this computer.",
        NotReadableError: "The camera is already in use by another application.",
        OverconstrainedError: "The selected camera is unavailable.",
      };
      setError(map[e.name] || `Camera error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [stopStream]);

  // Start on open, always release the camera on close/unmount
  useEffect(() => {
    if (open) {
      setSnapshot(null);
      startStream("");
    } else {
      stopStream();
    }
    return () => stopStream();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Revoke preview URL when it changes / unmounts
  useEffect(() => {
    return () => { if (snapshot?.url) URL.revokeObjectURL(snapshot.url); };
  }, [snapshot]);

  const handleDeviceChange = (e) => {
    setDeviceId(e.target.value);
    startStream(e.target.value);
  };

  const handleSnap = () => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => { if (blob) setSnapshot({ blob, url: URL.createObjectURL(blob) }); },
      "image/jpeg", 0.9,
    );
  };

  const handleUse = () => {
    if (!snapshot) return;
    onCapture(new File([snapshot.blob], fileName, { type: "image/jpeg" }));
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Take a photo</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {devices.length > 1 && !snapshot && (
          <Select size="small" fullWidth value={deviceId} onChange={handleDeviceChange} sx={{ mb: 2 }}>
            {devices.map((d, i) => (
              <MenuItem key={d.deviceId} value={d.deviceId}>
                {d.label || `Camera ${i + 1}`}
              </MenuItem>
            ))}
          </Select>
        )}

        <Box sx={{ position: "relative", bgcolor: "#000", borderRadius: 1, overflow: "hidden", minHeight: 240 }}>
          {loading && (
            <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CircularProgress size={28} />
            </Box>
          )}
          {/* Preview mirrored for natural feel; the captured image is NOT mirrored */}
          <video
            ref={setVideoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%", display: snapshot ? "none" : "block",
              transform: "scaleX(-1)",
            }}
          />
          {snapshot && (
            <img src={snapshot.url} alt="Preview" style={{ width: "100%", display: "block" }} />
          )}
        </Box>
        <canvas ref={canvasRef} style={{ display: "none" }} />
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        {snapshot ? (
          <>
            <Button startIcon={<ReplayIcon />} onClick={() => setSnapshot(null)}>Retake</Button>
            <Button variant="contained" onClick={handleUse}>Use this photo</Button>
          </>
        ) : (
          <Button variant="contained" startIcon={<CameraAltIcon />}
            onClick={handleSnap} disabled={loading || !!error}>
            Capture
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
