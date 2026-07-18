// =====================================================
// PATH: pointage/frontend/src/features/audit-log/page/AuditLogPage.jsx
// =====================================================
import React from "react";
import { Typography, Chip, IconButton, Tooltip, TablePagination, Alert } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";

import { useAuditLog } from "../hook/useAuditLog";
import { AuditLogFilters } from "../component/auditLogFilter";
import { AuditLogTable } from "../component/auditLogTable";

export default function AuditLogPage() {
  const {
    logs, total, loading, error,
    page, setPage, pageSize, setPageSize,
    filters, setFilter, resetFilters, hasActiveFilter,
    refresh, ACTION_OPTIONS,
  } = useAuditLog();

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Logs de suivi des actions</h1>
          <Chip label={total} size="small" color="primary" />
        </div>
        <Tooltip title="Actualiser">
          <IconButton onClick={refresh} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
      </div>

      {error && <Alert severity="error" className="mb-3">{error}</Alert>}

      <AuditLogFilters
        filters={filters}
        onFilterChange={setFilter}
        onReset={resetFilters}
        hasActiveFilter={hasActiveFilter}
        actionOptions={ACTION_OPTIONS}
      />

      <AuditLogTable logs={logs} loading={loading} />

      <TablePagination
        component="div" count={total} page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => {
          setPageSize(parseInt(e.target.value, 10));
          setPage(0);
        }}
        rowsPerPageOptions={[25, 50, 100]}
        labelRowsPerPage="Lignes par page"
        labelDisplayedRows={({ from, to, count }) => `${from}–${to} sur ${count}`}
      />
    </div>
  );
}