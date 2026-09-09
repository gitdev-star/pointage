import React from "react";

import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";

const LAST_ACTION_LABELS = {
  CREATE: {
    label: "Créé",
    color: "#2e7d32",
  },
  UPDATE: {
    label: "Modifié",
    color: "#1565c0",
  },
  DELETE: {
    label: "Supprimé",
    color: "#c62828",
  },
};

function LastActionCell({ action, at, by }) {
  if (!action) {
    return (
      <span style={{ fontSize: 12, color: "#999" }}>
        —
      </span>
    );
  }

  const meta = LAST_ACTION_LABELS[action] || {
    label: action,
    color: "#666",
  };

  const date = at ? new Date(at) : null;

  const formatted = date
    ? `${date.toLocaleDateString("fr-FR")} à ${date.toLocaleTimeString(
        "fr-FR",
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )}`
    : "";

  return (
    <div style={{ fontSize: 12 }}>
      <span
        style={{
          color: meta.color,
          fontWeight: 600,
        }}
      >
        {meta.label} {by ? `par ${by}` : "par le système"}
      </span>

      <div
        style={{
          color: "#777",
          fontSize: 11,
        }}
      >
        {formatted}
      </div>
    </div>
  );
}

/**
 * Cette fonction sert de solution de secours si une ancienne
 * réponse de l’API ne contient pas encore duration_formatted.
 */
function getFormattedDuration(request) {
  if (request.duration_formatted) {
    return request.duration_formatted;
  }

  if (request.start_time && request.end_time) {
    const [startHour, startMinute] = request.start_time
      .split(":")
      .map(Number);

    const [endHour, endMinute] = request.end_time
      .split(":")
      .map(Number);

    const startTotalMinutes =
      startHour * 60 + startMinute;

    const endTotalMinutes =
      endHour * 60 + endMinute;

    const totalMinutes =
      endTotalMinutes - startTotalMinutes;

    if (totalMinutes > 0) {
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, "0")} h ${String(
        minutes
      ).padStart(2, "0")} min`;
    }
  }

  /*
   * Compatibilité avec les anciens événements qui possèdent
   * uniquement duration_hours.
   */
  if (request.duration_hours !== null &&
      request.duration_hours !== undefined &&
      request.duration_hours !== "") {
    const decimalHours = Number(request.duration_hours);

    if (!Number.isNaN(decimalHours)) {
      const totalMinutes = Math.round(decimalHours * 60);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;

      return `${String(hours).padStart(2, "0")} h ${String(
        minutes
      ).padStart(2, "0")} min`;
    }
  }

  return "—";
}

function formatDate(value) {
  if (!value) return "—";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function formatTime(value) {
  if (!value) return null;
  return value.slice(0, 5);
}

export default function EventTable({
  requests = [],
  loading = false,
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

  const colSpan = 7;

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
              <strong>Durée</strong>
            </TableCell>

            <TableCell>
              <strong>Motif</strong>
            </TableCell>

            <TableCell>
              <strong>Dernière action</strong>
            </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={colSpan}
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
            requests.map((request) => {
              const isHourly =
                request.leave_type_code === "PM";

              return (
                <TableRow
                  key={request.id}
                  hover
                >
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

                  <TableCell>
                    <Chip
                      label={request.leave_type_name}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>

                  <TableCell>
                    <Box>
                      <div>
                        {formatDate(request.start_date)}
                      </div>

                      {isHourly && request.start_time && (
                        <Box
                          sx={{
                            fontSize: 12,
                            color: "text.secondary",
                          }}
                        >
                          {formatTime(request.start_time)}
                        </Box>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <Box>
                      <div>
                        {formatDate(request.end_date)}
                      </div>

                      {isHourly && request.end_time && (
                        <Box
                          sx={{
                            fontSize: 12,
                            color: "text.secondary",
                          }}
                        >
                          {formatTime(request.end_time)}
                        </Box>
                      )}
                    </Box>
                  </TableCell>

                  <TableCell>
                    <strong>
                      {isHourly
                        ? getFormattedDuration(request)
                        : `${request.days_requested} j`}
                    </strong>
                  </TableCell>

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

                  <TableCell>
                    <LastActionCell
                      action={request.last_action}
                      at={request.last_action_at}
                      by={request.last_action_by}
                    />
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}