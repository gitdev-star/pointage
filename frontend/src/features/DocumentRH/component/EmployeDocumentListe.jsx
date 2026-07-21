import React from "react";
import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Checkbox, CircularProgress, TablePagination
} from "@mui/material";
import { formatDateFR } from "../../../utils/dateUtils";

export default function EmployeeDocumentTable({
  employees,
  selectedIds,
  loading,
  page,
  total,
  rowsPerPage,
  onPageChange,
  onToggleOne,
  onToggleAll,
}) {

  console.log("employe:", employees)

  return (
    <Paper elevation={2}>
      <TableContainer>
        <Table size="small">
          
          <TableHead>
            <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={employees.length > 0 && selectedIds.length === employees.length}
                  indeterminate={selectedIds.length > 0 && selectedIds.length < employees.length}
                  onChange={onToggleAll}
                />
              </TableCell>
              <TableCell><strong>Matricule</strong></TableCell>
              <TableCell><strong>Nom</strong></TableCell>
              <TableCell><strong>Prénom</strong></TableCell>
              <TableCell><strong>Poste</strong></TableCell>
              <TableCell><strong>Date d'embauche</strong></TableCell>
              <TableCell><strong>Département</strong></TableCell>
              <TableCell><strong>Statut</strong></TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={28} />
                </TableCell>
              </TableRow>
            ) : employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 5 }}>
                  Aucun employé trouvé
                </TableCell>
              </TableRow>
            ) : (
              employees.map((emp) => (
                <TableRow
                  key={emp.employee_id}
                  hover
                  selected={selectedIds.includes(emp.employee_id)}
                  onClick={() => onToggleOne(emp.employee_id)}
                  sx={{ cursor: "pointer" }}
                >
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedIds.includes(emp.employee_id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleOne(emp.employee_id)}
                    />
                  </TableCell>
                  <TableCell>{emp.employee_id}</TableCell>
                  <TableCell>{emp.last_name}</TableCell>
                  <TableCell>{emp.first_name}</TableCell>
                  <TableCell>{emp.job_title_name || emp.job_title || "—"}</TableCell>
                  <TableCell>{formatDateFR(emp.hire_date)}</TableCell>
                  <TableCell>{emp.department_name || "—"}</TableCell>
                  <TableCell>{emp.status}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
  component="div"
  count={total}
  page={page}
  onPageChange={(_, newPage) => onPageChange(newPage)}
  rowsPerPage={rowsPerPage}
  rowsPerPageOptions={[rowsPerPage]}
  labelRowsPerPage="Lignes par page"
  labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
/>
    </Paper>
  );
}