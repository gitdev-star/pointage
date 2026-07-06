// import { useMemo } from "react";

// const LATE_THRESHOLD = "07:40"; 
// function extractTime(arrival) {
//   if (!arrival) return null;
//   const timePart = arrival.includes("T")
//     ? arrival.split("T")[1]
//     : arrival.includes(" ") && arrival.indexOf(" ") === 10
//       ? arrival.split(" ")[1]   // "YYYY-MM-DD HH:MM:SS"
//       : arrival;                // déjà "HH:MM:SS" ou "HH:MM"
//   return timePart.slice(0, 5);  // → "HH:MM"
// }

// export function useTodayLate(todayRecords = []) {
//   const lateList = useMemo(() => {
//     return todayRecords.filter((r) => {
//       const time = extractTime(r.arrival);
//       if (!time) return false;
//       return time > LATE_THRESHOLD;
//     });
//   }, [todayRecords]);

//   return { lateList, count: lateList.length, threshold: LATE_THRESHOLD };
// }















import { useMemo } from "react";

function extractTime(arrival) {
  if (!arrival) return null;
  const timePart = arrival.includes("T")
    ? arrival.split("T")[1]
    : arrival.includes(" ") && arrival.indexOf(" ") === 10
      ? arrival.split(" ")[1]
      : arrival;
  return timePart.slice(0, 5);
}

export function useTodayLate(lateRecords = [], kpi = {}) {
  return {
    lateList: lateRecords,
    count: kpi?.late ?? lateRecords.length,
    threshold: kpi?.late_threshold || "07:40",
  };
}