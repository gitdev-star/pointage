import React, { useState } from "react";
import EventTable from "../components/EventTable";
import EventFilter from "../components/EventFilter";
import ApprovalDialog from "../components/ApprovalDialogue";
import useLeaveRequests from "../hook/useLeaveRequest";
import useLeaveTypes from "../hook/useLeaveType";
import { useHRAuth } from "../../../contexts/HRAuthContext";
import EvenementModal from "../components/EvenementModal"

export default function LeaveRequestPage() {
  const { can } = useHRAuth();

  const [filters, setFilters] = useState({
    status: "", search: "", leave_type: "", factory: "", date_from: "", date_to: "",
  });
  const [approvalDialog, setApprovalDialog] = useState(null);
  const [createDialog, setCreateDialog] = useState(false);

  const { requests, loading, approveRequest, rejectRequest, createRequest, fetchRequests } =
    useLeaveRequests(filters);

  const { leaveTypes } = useLeaveTypes();

  const handleFilterChange = (key, val) =>
    setFilters((prev) => ({ ...prev, [key]: val }));

  return (
    <>
      <EventFilter
        filters={filters}
        onChange={handleFilterChange}
        onAdd={() => setCreateDialog(true)}
        onRefresh={fetchRequests}
        leaveTypes={leaveTypes} 
      />

      <EventTable
        requests={requests}
        loading={loading}
        canApprove={can("leaves_approve")}
        onApprove={(leave) => setApprovalDialog({ leave, action: "approve" })}
        onReject={(leave) => setApprovalDialog({ leave, action: "reject" })}
      />

      <ApprovalDialog
        open={!!approvalDialog}
        data={approvalDialog}
        onClose={() => setApprovalDialog(null)}
        onConfirm={async (reason) => {
          if (approvalDialog.action === "approve") {
            await approveRequest(approvalDialog.leave.id);
          } else {
            await rejectRequest(approvalDialog.leave.id, reason);
          }
          setApprovalDialog(null);
        }}
      />

      <EvenementModal
        open={createDialog}
        leaveTypes={leaveTypes}
        onClose={() => setCreateDialog(false)}
        onSave={async (data) => {
          await createRequest(data);
          setCreateDialog(false);
        }}
      />
    </>
  );
}