// import React from "react";

// import useAttendanceData from "../hook/usePresence";
// import DashboardHeader from "../components/PresenceHeader";
// import StatsGrid from "../components/StatGrid";
// import PresenceCharts from "../components/PresenceChart";
// import useExportPresence from "../hook/useExportRapport";

// export default function PresenceDashboard() {
//   const { state, actions } = useAttendanceData();
//   const { exportToExcel } = useExportPresence();

// const absentCount = state.totalActive != null && state.kpi?.presents != null
//   ? Math.max(0, state.totalActive - state.kpi.presents)
//   : 0;

//   const handleExport = () => {
//     exportToExcel({
//       attendanceData: state.attendanceData,
//       kpi:            state.kpi,
//       totalActive:    state.totalActive,
//       stats:          state.stats,
//       getEmployeeName: actions.getEmployeeName,
//       filters:        state.filters,
//     });
//   };
  
// console.log("state:", state)

//   return (
//     <div className="min-h-screen bg-gray-100 p-6">
//       <DashboardHeader
//         loading={state.loading}
//         onRefresh={actions.fetchAttendance}
//         onExport={handleExport}  
//       />
//            <StatsGrid
//         stats={state.stats}
//         totalRecords={state.attendanceData.length}
//         kpi={state.kpi}
//         totalActive={state.totalActive}
//         absentCount={absentCount} 
//       />

//       <PresenceCharts
//         kpi={state.kpi}
//         totalActive={state.totalActive}
//         attendanceData={state.attendanceData}
//         absentCount={absentCount} 
//       />
//     </div>
//   );
// }






import React from "react";
import useAttendanceData from "../hook/usePresence";
import DashboardHeader from "../components/PresenceHeader";
import StatsGrid from "../components/StatGrid";
import PresenceCharts from "../components/PresenceChart";
import LateByFactoryChart from "../components/LateByFactoryChart";
import useLateByFactory from "../hook/useLateByFactory";
import useExportPresence from "../hook/useExportRapport";

export default function PresenceDashboard() {
  const { state, actions } = useAttendanceData();
  const { exportToExcel } = useExportPresence();

  const today = new Date().toISOString().split("T")[0];
  const { data: factoryData, loading: factoryLoading } = useLateByFactory(state.employeeMap, today);

  const absentCount = state.totalActive != null && state.kpi?.presents != null
    ? Math.max(0, state.totalActive - state.kpi.presents)
    : 0;

  const handleExport = () => {
    exportToExcel({
      attendanceData: state.attendanceData,
      kpi: state.kpi,
      totalActive: state.totalActive,
      stats: state.stats,
      getEmployeeName: actions.getEmployeeName,
      filters: state.filters,
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <DashboardHeader
        loading={state.loading}
        onRefresh={actions.fetchAttendance}
        onExport={handleExport}
      />
      <StatsGrid
        stats={state.stats}
        totalRecords={state.attendanceData.length}
        kpi={state.kpi}
        totalActive={state.totalActive}
        absentCount={absentCount}
      />

      <PresenceCharts
        kpi={state.kpi}
        totalActive={state.totalActive}
        attendanceData={state.attendanceData}
        absentCount={absentCount}
      />

      <LateByFactoryChart data={factoryData} loading={factoryLoading} />

    </div>
  );
}