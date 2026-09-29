import {
  Box, Chip, CircularProgress, IconButton, Paper, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";

export default function SanctionTable({ sanctions, loading, canWrite, onEdit }) {
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
            <TableCell><strong>Employé</strong></TableCell>
            <TableCell><strong>Matricule</strong></TableCell>
            <TableCell><strong>Sanction</strong></TableCell>
            <TableCell><strong>Date</strong></TableCell>
            <TableCell><strong>Motif</strong></TableCell>
            {canWrite && <TableCell align="center"><strong>Actions</strong></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {sanctions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>
                Aucune sanction trouvée
              </TableCell>
            </TableRow>
          ) : sanctions.map((row) => (
            <TableRow key={row.id} hover>
              <TableCell>{row.employee_name}</TableCell>
              <TableCell sx={{ fontFamily: "monospace" }}>{row.employee_id_str}</TableCell>
              <TableCell>
                <Chip
                  label={row.sanction_type_name}
                  size="small"
                  sx={{ bgcolor: row.sanction_color, color: "#fff", fontWeight: 600 }}
                />
              </TableCell>
              <TableCell>{row.date}</TableCell>
              <TableCell sx={{ maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {row.reason}
              </TableCell>
              {canWrite && (
                <TableCell align="center">
                  <IconButton size="small" onClick={() => onEdit(row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}