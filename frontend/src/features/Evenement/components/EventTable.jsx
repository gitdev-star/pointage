import React from "react";

import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import {
  STATUS_COLORS,
  STATUS_LABELS,
} from "../constant/EventConstant";

export default function EventTable({
  requests = [],
  loading = false,
  canApprove = false,
  onApprove,
  onReject,
}) {
  if (loading) {
    return (
      <Paper
        sx={{
          py: 6,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <CircularProgress />
      </Paper>
    );
  }

  return (
    <TableContainer
      component={Paper}
      elevation={2}
    >
      <Table size="small">

        <TableHead>
          <TableRow
            sx={{
              backgroundColor: "#f5f5f5",
            }}
          >
            <TableCell>
              <strong>Employé</strong>
            </TableCell>

            <TableCell>
              <strong>Type</strong>
            </TableCell>

            <TableCell>
              <strong>Début</strong>
            </TableCell>

            <TableCell>
              <strong>Fin</strong>
            </TableCell>

            <TableCell>
              <strong>Jours</strong>
            </TableCell>

            <TableCell>
              <strong>Motif</strong>
            </TableCell>

            <TableCell>
              <strong>Statut</strong>
            </TableCell>

            {canApprove && (
              <TableCell width={120}>
                <strong>Actions</strong>
              </TableCell>
            )}
          </TableRow>
        </TableHead>

        <TableBody>

          {requests.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={canApprove ? 8 : 7}
                align="center"
                sx={{
                  py: 5,
                  color: "text.secondary",
                }}
              >
                Aucun événement trouvé
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow
                key={request.id}
                hover
              >
                {/* Employé */}
                <TableCell>
                  <Box>
                    <strong>
                      {request.employee_name}
                    </strong>

                    {request.employee_id && (
                      <Box
                        sx={{
                          fontSize: 12,
                          color: "text.secondary",
                          fontFamily: "monospace",
                        }}
                      >
                        {request.employee_id}
                      </Box>
                    )}
                  </Box>
                </TableCell>

                {/* Type */}
                <TableCell>
                  <Chip
                    label={
                      request.leave_type_name
                    }
                    size="small"
                    variant="outlined"
                  />
                </TableCell>

                {/* Début */}
                <TableCell>
                  {request.start_date}
                </TableCell>

                {/* Fin */}
                <TableCell>
                  {request.end_date}
                </TableCell>

                {/* Jours */}
                <TableCell>
                  <strong>
                    {request.days_requested}j
                  </strong>
                </TableCell>

                {/* Motif */}
                <TableCell
                  sx={{
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {request.reason || "—"}
                </TableCell>

                {/* Statut */}
                <TableCell>
                  <Chip
                    size="small"
                    label={
                      STATUS_LABELS[
                        request.status
                      ]
                    }
                    color={
                      STATUS_COLORS[
                        request.status
                      ]
                    }
                  />
                </TableCell>

                {/* Actions */}
                {canApprove && (
                  <TableCell>

                    {request.status ===
                      "PENDING" && (
                      <Box
                        sx={{
                          display: "flex",
                          gap: 0.5,
                        }}
                      >
                        <Tooltip title="Approuver">
                          <IconButton
                            size="small"
                            color="success"
                            onClick={() =>
                              onApprove(
                                request
                              )
                            }
                          >
                            <CheckIcon
                              fontSize="small"
                            />
                          </IconButton>
                        </Tooltip>

                        <Tooltip title="Rejeter">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                              onReject(
                                request
                              )
                            }
                          >
                            <CloseIcon
                              fontSize="small"
                            />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}

                  </TableCell>
                )}
              </TableRow>
            ))
          )}

        </TableBody>

      </Table>
    </TableContainer>
  );
}