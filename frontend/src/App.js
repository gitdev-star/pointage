import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AuthCallback from './pages/AuthCallback';
import LoginPage from "./components/LoginPage";
import DeviceStatus from "./components/DeviceStatus";
import ProfilePage from "./components/ProfilePage";
import SecurePage from "./components/SecurePage";
import ProtectedRoute from "./routes/ProtectedRoute";
import AttendanceAnalysis from "./components/AttendanceAnalysis";
// import EmployeeList   from "./components/hr/EmployeeList";
import EmployeeImport from "./components/hr/EmployeeImport";
// import LeaveRequests  from "./components/hr/LeaveRequests";
import Payroll        from "./components/hr/Payroll";
import Reports        from "./components/hr/Reports";
import ShiftsEvents   from "./components/hr/ShiftsEvents";
import HRUsers       from "./components/hr/HRUsers";
import HRPermissions  from "./components/hr/HRPermissions";
// import EmployeeFiche       from "./components/hr/EmployeeFiche";
// import HREvents           from "./components/hr/HREvents";
// import Sanctions          from "./components/hr/Sanctions";
import CDDAlerts         from "./components/hr/CDDAlerts";
import MaternityLeave    from "./components/hr/MaternityLeave";
import NotificationsRH   from "./components/hr/NotificationsRH";
import RegistrePersonnel   from './components/hr/RegistrePersonnel';
import OrganisationManager from "./components/hr/OrganisationManager";
import WorkSchedules from "./components/hr/WorkSchedules";
import ScheduleAssignment from "./components/hr/ScheduleAssignment";
import PresenceDashboard from "./features/Presence/page/PresenceDashboard";
import RetardPage from "./features/Retard/page/RetardPage";
import DashboardLayout from "./components/layout/DashboardLayout";
// import PresencePage from "./features/Presence/page/PresencePage";
import EmployeeList from "./features/Employe/page/EmployeListe";
import EmployeeFiche from "./features/Employe/page/EmployeFiche";
import EventsPage from "./features/Evenement/page/EvenementPage";
import DocumentsRH from "./features/DocumentRH/page/DocumentPage";
import HRAttendanceDashboard from "./features/Presence/page/PresencePage";
import SanctionPage from "./features/Sanction/page/SanctionPage";
import TransportPage from "./features/Transport/page/TransportPage";
import WorkSchedulePage from "./features/Horaire/page/HorairePage";
import AuditLogPage from "./features/AuditLog/page/auditLogPage";
import CantineDashboard from "./features/Cantine/cantinePage";
import DashboardRecrutement from "./features/Recrutement/component/Dashboard";
import ValidationDemandeRecrutement from "./features/Recrutement/component/ValidationDemandeRecrutement";
import DemandeRecrutementPage from "./features/Recrutement/component/DemandeRecrutementPage";
import ProcessusRecrutement from "./features/Recrutement/component/ProcessusRecrutement";
import DetailProcessusRecrutement from "./features/Recrutement/component/DetailProceRecru";
import CompteRenduEntretienCadre from "./features/Recrutement/component/CompteRendu";


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/"                   element={<ProtectedRoute module="dashboard"><PresenceDashboard /></ProtectedRoute>} />
          <Route path="attendance"          element={<ProtectedRoute module="presence"><HRAttendanceDashboard /></ProtectedRoute>} />
          <Route path="attendance/analysis" element={<ProtectedRoute module="presence"><AttendanceAnalysis /></ProtectedRoute>} />
          <Route path="devices"             element={<ProtectedRoute module="devices"><DeviceStatus /></ProtectedRoute>} />
          <Route path="profile"             element={<ProfilePage />} />
          <Route path="secure"              element={<SecurePage />} />
          <Route path="hr/employees"        element={< EmployeeList />} />
          <Route path="hr/employees/:id"    element={<EmployeeFiche />} />
          <Route path="/hr/audit-logs"    element={<AuditLogPage />} />
          <Route path="/hr/cantine"    element={<CantineDashboard />} />
          {/* <Route path="hr/events"           element={<LeaveRequests />} /> */}
          <Route path="/hr/document" element={<DocumentsRH />} />
          <Route path="/hr/transport" element={<TransportPage />} />
          <Route path="/hr/horaire" element={<WorkSchedulePage />} />
          <Route path="hr/sanctions"        element={<SanctionPage />} />
          <Route path="hr/import"           element={<EmployeeImport />} />
          <Route path="hr/leaves"           element={<EventsPage />} />
          <Route path="hr/payroll"          element={<Payroll />} />
          <Route path="hr/reports"          element={<Reports />} />
          <Route path="hr/shifts"           element={<ShiftsEvents />} />
          <Route path="hr/users"            element={<HRUsers />} />
          <Route path="hr/permissions"      element={<HRPermissions />} />
          <Route path="hr/organisation"     element={<OrganisationManager />} />
          <Route path="hr/registre"         element={<RegistrePersonnel />} />
          <Route path="hr/cdd-alerts"       element={<CDDAlerts />} />
          <Route path="hr/notifications"    element={<NotificationsRH />} />
          <Route path="hr/maternity"        element={<MaternityLeave />} />
	        <Route path="hr/work-schedules" element={<WorkSchedules />} />
          <Route path="hr/schedule-assignment" element={<ScheduleAssignment />} />
	        <Route path="attendance/late-report" element={<ProtectedRoute module="retard"><RetardPage /></ProtectedRoute>} />
        <Route path="/hr/recrutement" element={<DashboardRecrutement />} />
          <Route
  path="/hr/recrutement/demande"
  element={< DemandeRecrutementPage/>}
/>

<Route
  path="/hr/recrutement/demandes/:id/validation"
  element={<ValidationDemandeRecrutement />}
/>

<Route
  path="/hr/recrutement/demandes/:id/approbation-drh"
  element={
    <ValidationDemandeRecrutement />
  }
/>

<Route
  path="/hr/recrutement/processus"
  element={<ProcessusRecrutement />}
/>

<Route
  path="/hr/recrutement/processus/:id"
  element={<DetailProcessusRecrutement />}
/>

<Route
  path="/hr/recrutement/comptes-rendus"
  element={<CompteRenduEntretienCadre />}
/>

</Route>
      </Routes>
    </Router>
  );
}
export default App;
