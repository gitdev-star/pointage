import React, { useState } from "react";
import { Tabs, Tab, Box } from "@mui/material";

import LeaveRequestPage from "./LeaveRequestPage";

import MaternityLeave from "../../../components/hr/MaternityLeave";
import SanctionPage from "../../Sanction/page/SanctionPage";
import EventTypePage from "../../TypeEvent/page/EventTypePage";

// import EventTypeManager from "../components/EventTypeManager";

export default function EvenementPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ p: 3 }}>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        className="mb-10"
      >
        <Tab label="Événements" />
        <Tab label="Maternité" />
        <Tab label="Sanctions" />
        <Tab label="Types" />
      </Tabs>

      {tab === 0 && <LeaveRequestPage />}
      {tab === 1 && <MaternityLeave embedded />}
      {tab === 2 && <SanctionPage />}
      {tab === 3 && <EventTypePage />}
    </Box>
  );
}