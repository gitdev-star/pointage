import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  TextField,
  Box,
} from "@mui/material";

export default function ApprovalDialog({
  open,
  data,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!open) {
      setReason("");
    }
  }, [open]);

  if (!data) return null;

  const isApprove = data.action === "approve";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle fontWeight={700}>
        {isApprove
          ? "Approuver l'événement"
          : "Rejeter l'événement"}
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <Typography>
            <strong>
              {data.leave.employee_name}
            </strong>
          </Typography>

          <Typography variant="body2" sx={{ mt: 1 }}>
            {data.leave.leave_type_name}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {data.leave.start_date} → {data.leave.end_date}
          </Typography>

          <Typography
            variant="body2"
            color="text.secondary"
          >
            {data.leave.days_requested} jour(s)
          </Typography>

          {!isApprove && (
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Motif du rejet"
              sx={{ mt: 3 }}
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
            />
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>
          Annuler
        </Button>

        <Button
          variant="contained"
          color={isApprove ? "success" : "error"}
          onClick={() => onConfirm(reason)}
        >
          {isApprove
            ? "Approuver"
            : "Rejeter"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}