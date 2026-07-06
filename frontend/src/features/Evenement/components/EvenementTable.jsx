// import React from "react";
// import {
//   Table, TableBody, TableCell, TableContainer,
//   TableHead, TableRow, Paper, Chip, IconButton
// } from "@mui/material";
// import EditIcon from "@mui/icons-material/Edit";

// import {
//   STATUS_LABELS,
//   STATUS_COLORS,
//   CATEGORY_LABELS,
//   CATEGORY_COLORS
// } from "../constant/EventConstant";

// export default function EventTable({ events, loading, types, onEdit }) {
//   const getPaid = (typeId) =>
//     types.find(t => t.id === typeId)?.is_paid;

//   return (
//     <TableContainer component={Paper}>
//       <Table size="small">

//         <TableHead>
//           <TableRow>
//             <TableCell>Employé</TableCell>
//             <TableCell>Type</TableCell>
//             <TableCell>Catégorie</TableCell>
//             <TableCell>Statut</TableCell>
//             <TableCell>Actions</TableCell>
//           </TableRow>
//         </TableHead>

//         <TableBody>
//           {events.map(e => (
//             <TableRow key={e.id} hover>

//               <TableCell>{e.employee_name}</TableCell>

//               <TableCell>{e.event_type_name}</TableCell>

//               <TableCell>
//                 <Chip
//                   label={CATEGORY_LABELS[e.event_category]}
//                   color={CATEGORY_COLORS[e.event_category]}
//                   size="small"
//                 />
//               </TableCell>

//               <TableCell>
//                 <Chip
//                   label={STATUS_LABELS[e.status]}
//                   color={STATUS_COLORS[e.status]}
//                   size="small"
//                 />
//               </TableCell>

//               <TableCell>
//                 <IconButton onClick={() => onEdit(e)}>
//                   <EditIcon />
//                 </IconButton>
//               </TableCell>

//             </TableRow>
//           ))}
//         </TableBody>

//       </Table>
//     </TableContainer>
//   );
// }