import { useState } from "react";
import { Alert, Box, Button, IconButton, Typography } from "@mui/material";
import AddIcon     from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useHRAuth } from "../../../contexts/HRAuthContext";
import useEventTypes    from "../hook/useTypeEvent";
import EventTypeTable   from "../component/EventTypeTable";
import EventTypeDialog  from "../component/EventTypeDialogue";

export default function EventTypePage() {
  const { can } = useHRAuth();

  const [alert, setAlert]       = useState(null);
  const [dialog, setDialog]     = useState(false);
  const [editItem, setEditItem] = useState(null);

  const { eventTypes, loading, fetchEventTypes, createEventType, updateEventType } =
    useEventTypes();

  const openCreate = () => { setEditItem(null); setDialog(true); };
  const openEdit   = (t)  => { setEditItem(t);  setDialog(true); };

  const handleSave = async (form) => {
    try {
      if (editItem) {
        await updateEventType(editItem.id, form);
        setAlert({ type: "success", msg: "Type mis à jour." });
      } else {
        await createEventType(form);
        setAlert({ type: "success", msg: "Type d'événement créé." });
      }
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de l'enregistrement." });
      throw new Error();
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h5" fontWeight={700}>Types d'événement</Typography>
        <Box display="flex" gap={1}>
          <IconButton onClick={fetchEventTypes}><RefreshIcon /></IconButton>
          {can("leaves_write") && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
              Nouveau type
            </Button>
          )}
        </Box>
      </Box>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.msg}
        </Alert>
      )}

      <EventTypeTable
        eventTypes={eventTypes}
        loading={loading}
        canWrite={can("leaves_write")}
        onEdit={openEdit}
      />

      <EventTypeDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        onSave={handleSave}
      />
    </Box>
  );
}