import {
  Box, Button, Chip, CircularProgress, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow,
} from "@mui/material";

export default function EventTypeTable({ eventTypes, loading, canWrite, onEdit }) {
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small">
        <TableHead>
          <TableRow sx={{ bgcolor: "grey.50" }}>
            <TableCell><strong>Code</strong></TableCell>
            <TableCell><strong>Nom</strong></TableCell>
            <TableCell><strong>Jours/an</strong></TableCell>
            <TableCell><strong>Payé</strong></TableCell>
            <TableCell><strong>Document requis</strong></TableCell>
            <TableCell><strong>Statut</strong></TableCell>
            {canWrite && <TableCell align="center"><strong>Actions</strong></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {eventTypes.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Aucun type d'événement trouvé
              </TableCell>
            </TableRow>
          ) : eventTypes.map((t) => (
            <TableRow key={t.id} hover>
              <TableCell>
                <Box display="flex" alignItems="center" gap={1}>
                  <Box sx={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: t.color }} />
                  <strong>{t.code}</strong>
                </Box>
              </TableCell>
              <TableCell>{t.name}</TableCell>
              <TableCell>{t.days_per_year > 0 ? `${t.days_per_year}j` : "Illimité"}</TableCell>
              <TableCell>
                <Chip label={t.is_paid ? "Payé" : "Non payé"} color={t.is_paid ? "success" : "default"} size="small" />
              </TableCell>
              <TableCell>
                <Chip label={t.requires_document ? "Oui" : "Non"} color={t.requires_document ? "warning" : "default"} size="small" />
              </TableCell>
              <TableCell>
                <Chip label={t.is_active ? "Actif" : "Inactif"} color={t.is_active ? "success" : "default"} size="small" />
              </TableCell>
              {canWrite && (
                <TableCell align="center">
                  <Button size="small" variant="outlined" onClick={() => onEdit(t)}>
                    Modifier
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}