import { useState } from "react";
import { Alert, Box, IconButton, Tab, Tabs, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useHRAuth } from "../../../contexts/HRAuthContext";
import useSanctions from "../hook/useSanction";
import SanctionFilter      from "../component/SanctionFilter";
import SanctionTable       from "../component/SanctionTable";
import SanctionDialog      from "../component/SanctionDialogue";
import SanctionTypeManager from "../component/SanctionTypeManager";

export default function SanctionPage() {
  const { can } = useHRAuth();

  const [mainTab, setMainTab]   = useState(0);
  const [tab, setTab] = useState("");
  const [searchEmp, setSearchEmp] = useState("");
  const [alert, setAlert]       = useState(null);
  const [dialog, setDialog]     = useState(false);
  const [editItem, setEditItem] = useState(null);

  const {
    sanctions, sanctionTypes, loading,
    fetchAll, createSanction, updateSanction,
    createType, updateType, toggleType, autoTerminate,
  } = useSanctions(tab, searchEmp);

  const handleSave = async (form, isLic) => {
    try {
      if (editItem) {
        await updateSanction(editItem.id, form);
        setAlert({ type: "success", msg: "Sanction mise à jour" });
      } else {
        await createSanction(form);
        if (isLic && form.status === "ACTIVE") {
          try {
            await autoTerminate(form.employee, form.date, form.reason);
            setAlert({ type: "success", msg: "Sanction créée — employé automatiquement résilié." });
          } catch {
            setAlert({ type: "warning", msg: "Sanction créée, mais impossible de mettre à jour le statut de l'employé." });
          }
        } else {
          setAlert({ type: "success", msg: "Sanction créée" });
        }
      }
    } catch {
      setAlert({ type: "error", msg: "Erreur lors de l'enregistrement" });
      throw new Error(); // reraise pour que le dialog reste ouvert
    }
  };

  const openCreate = () => { setEditItem(null); setDialog(true); };
  const openEdit   = (row) => { setEditItem(row); setDialog(true); };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5" fontWeight={700}>Sanctions disciplinaires</Typography>
        <IconButton onClick={fetchAll}><RefreshIcon /></IconButton>
      </Box>

      {alert && (
        <Alert severity={alert.type} onClose={() => setAlert(null)} sx={{ mb: 2 }}>
          {alert.msg}
        </Alert>
      )}

      <Tabs value={mainTab} onChange={(_, v) => setMainTab(v)} sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Sanctions" />
        <Tab label="Types de sanctions" />
      </Tabs>

      {mainTab === 0 && (
        <>
<SanctionFilter
  tab={tab}
  onTabChange={setTab}
  search={searchEmp}
  onSearchChange={setSearchEmp}
  canWrite={can("sanctions_write")}
  onAdd={openCreate}
/>
          <SanctionTable
            sanctions={sanctions}
            loading={loading}
            canWrite={can("sanctions_write")}
            onEdit={openEdit}
          />
        </>
      )}

      {mainTab === 1 && (
        <SanctionTypeManager
          sanctionTypes={sanctionTypes}
          canWrite={can("sanctions_write")}
          onCreate={createType}
          onUpdate={updateType}
          onToggle={toggleType}
        />
      )}

      <SanctionDialog
        open={dialog}
        onClose={() => setDialog(false)}
        editItem={editItem}
        sanctionTypes={sanctionTypes}
        onSave={handleSave}
      />
    </Box>
  );
}