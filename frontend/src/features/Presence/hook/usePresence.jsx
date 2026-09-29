// import { useState, useEffect, useCallback, useRef } from "react";
// import useDebounce from "./useDebounce";
// import hrClient from "../../../api/hrClient";
// import { attendanceService } from "../api/PresenceService";

// export default function useAttendanceData() {
//   // const API_BASE = process.env.REACT_APP_API_URL + "/attendance/";

//   const today = new Date().toISOString().split("T")[0];
//   const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];

//   const [attendanceData, setAttendanceData] = useState([]);
//   const [stats, setStats] = useState({});
//   const [kpi, setKpi] = useState({});
//   const [totalActive, setTotalActive] = useState(null);

//   const [availableIPs, setAvailableIPs] = useState([]);
//   const [clockers, setClockers] = useState([]);
//   const [employeeMap, setEmployeeMap] = useState({});

//   const [loading, setLoading] = useState(false);
//   const [kpiLoading, setKpiLoading] = useState(false);

//   const [selectedRecord, setSelectedRecord] = useState(null);
//   const [showModal, setShowModal] = useState(false);

//   const [filters, setFilters] = useState({
//     user_id: "",
//     date_from: sevenDaysAgo,
//     date_to: today,
//     time_from: "",
//     time_to: "",
//     device_ip: "",
//     period: "",
//     target_date: "",
//     skip: 0,
//     limit: 1000
//   });

//   const debouncedUserId = useDebounce(filters.user_id, 400);
//   const abortRef = useRef(null);

//   // ───────────────────────── EMPLOYEES MAP ─────────────────────────
// const fetchEmployees = useCallback(async () => {
//   const res = await hrClient.get("employees/", {
//     params: { page_size: 5000, status: "ACTIVE" }
//   });

//   const map = {};
//   (res.data.results ?? res.data).forEach(e => {
//     const id = Number(e.device_user_id || e.employee_id);
//     if (!id) return;

//     map[id] = {
//       name: `${e.first_name} ${e.last_name}`,
//       empId: e.employee_id,
//       factoryName: e.factory_name || "Non assigné",
//     };
//   });

//   setEmployeeMap(map);
// }, []);

//   // ───────────────────────── CLOCKERS ─────────────────────────
//   const fetchClockers = useCallback(async () => {
//     try {
//       const res = await fetch(`${process.env.REACT_APP_CLOCKERS_URL || `${window.location.origin}/api/clockers`}/`);
//       if (!res.ok) return;
//       const data = await res.json();
//       setClockers(Array.isArray(data) ? data : []);
//     } catch (_) {}
//   }, []);

//   // ───────────────────────── FETCH MAIN DATA ─────────────────────────
// const fetchAttendance = useCallback(async () => {
//   if (abortRef.current) abortRef.current.abort();
//   abortRef.current = new AbortController();
//   const signal = abortRef.current.signal;
//   setLoading(true);

//   try {
//     const PAGE_SIZE = 1000;

//     const buildParams = (skip) => {
//       const p = new URLSearchParams();
//       p.append("date_from", filters.date_from);
//       p.append("date_to",   filters.date_to);
//       p.append("skip",      skip);
//       p.append("limit",     PAGE_SIZE);
//       if (filters.user_id) p.append("user_id", Number(filters.user_id));
//       return p.toString();
//     };

//     // Page 0 — on récupère aussi le total
//     const { data: firstPage, totalCount } =
//       await attendanceService.getGroupedWithCount(buildParams(0), signal);

//     if (!totalCount || firstPage.length >= totalCount) {
//       setAttendanceData(firstPage);
//       await Promise.all([fetchStats(), fetchKpi()]);
//       return;
//     }

//     // Pages suivantes en parallèle
//     const totalPages = Math.ceil(totalCount / PAGE_SIZE);
//     const rest = await Promise.all(
//       Array.from({ length: totalPages - 1 }, (_, i) =>
//         attendanceService.getGroupedWithCount(buildParams((i + 1) * PAGE_SIZE), signal)
//           .then(({ data }) => data)
//       )
//     );

//     setAttendanceData([firstPage, ...rest].flat());
//     await Promise.all([fetchStats(), fetchKpi()]);

//   } catch (err) {
//     if (err.name === "CanceledError" || err.name === "AbortError" || err.code === "ERR_CANCELED") return;
//     console.error("Erreur fetchAttendance:", err);
//   } finally {
//     setLoading(false);
//   }
// }, [filters]);

//   // ───────────────────────── STATS ─────────────────────────
//   const fetchStats = async () => {
//     const params = new URLSearchParams();
//     params.append("date_from", filters.date_from);
//     params.append("date_to", filters.date_to);

//     const data = await attendanceService.getStats(params.toString());
//     setStats(data);
//   };

// const fetchKpi = async () => {
//   setKpiLoading(true);
//   try {
//     const today = new Date().toISOString().split('T')[0];

//     const [kpiRes, empRes] = await Promise.all([
//       attendanceService.getKpi(today),          // ✅ utilise fastapiClient avec token
//       hrClient.get('employees/', { params: { status: 'ACTIVE', page_size: 1 } }),
//     ]);

//     // ✅ utilise les valeurs directes, pas le state (qui n'est pas encore mis à jour)
//     const kpiData = kpiRes;
//     const total = empRes.data?.count ?? null;

//     setKpi(kpiData);
//     setTotalActive(total);
//   } catch (err) {
//     console.error('KPI error:', err);
//   } finally {
//     setKpiLoading(false);
//   }
// };


//   // ───────────────────────── HELPERS ─────────────────────────
//   const getEmployeeName = (id) => employeeMap[Number(id)]?.name || null;

//   const getClockerName = (ip) =>
//     clockers.find(c => c.ip_address === ip)?.specific_name || ip;

//   const exportToExcel = () => {
//     const csv = attendanceData.map(r => ({
//       id: r.user_id,
//       name: getEmployeeName(r.user_id),
//       date: r.date,
//       arrival: r.arrival,
//       departure: r.departure
//     }));

//     const blob = new Blob([JSON.stringify(csv)], { type: "text/csv" });
//     const url = URL.createObjectURL(blob);

//     const a = document.createElement("a");
//     a.href = url;
//     a.download = "attendance.csv";
//     a.click();
//   };

//   // ───────────────────────── EFFECTS ─────────────────────────
//   useEffect(() => { fetchAttendance(); }, [filters, debouncedUserId]);
//   useEffect(() => {
//     fetchEmployees();
//     fetchClockers();
//   }, []);

//   return {
//     state: {
//       attendanceData,
//       stats,
//       kpi,
//       totalActive,
//       filters,
//       loading,
//       kpiLoading,
//       availableIPs,
//       clockers,
//       selectedRecord,
//       showModal,
//       employeeMap
//     },
//     actions: {
//       setFilters,
//       fetchAttendance,
//       exportToExcel,
//       getEmployeeName,
//       getClockerName,
//       setSelectedRecord,
//       setShowModal
//     }
//   };
// }










//----------------------------------------------------------------------------




import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";

import useDebounce from "./useDebounce";
import hrClient from "../../../api/hrClient";

import {
  attendanceService,
} from "../api/PresenceService";


const formaterDateLocale = (date) => {
  const annee = date.getFullYear();

  const mois = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  const jour = String(
    date.getDate()
  ).padStart(2, "0");

  return `${annee}-${mois}-${jour}`;
};


export default function useAttendanceData() {
  const maintenant = new Date();

  const today =
    formaterDateLocale(maintenant);

  const debutPeriode = new Date(
    maintenant
  );

  debutPeriode.setDate(
    debutPeriode.getDate() - 7
  );

  const sevenDaysAgo =
    formaterDateLocale(debutPeriode);

  const [
    attendanceData,
    setAttendanceData,
  ] = useState([]);

  const [
    stats,
    setStats,
  ] = useState({});

  const [
    kpi,
    setKpi,
  ] = useState({});

  const [
    totalActive,
    setTotalActive,
  ] = useState(null);

  const [
    availableIPs,
    setAvailableIPs,
  ] = useState([]);

  const [
    clockers,
    setClockers,
  ] = useState([]);

  const [
    employeeMap,
    setEmployeeMap,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    kpiLoading,
    setKpiLoading,
  ] = useState(false);

  const [
    selectedRecord,
    setSelectedRecord,
  ] = useState(null);

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    filters,
    setFilters,
  ] = useState({
    user_id: "",
    date_from: sevenDaysAgo,
    date_to: today,
    time_from: "",
    time_to: "",
    device_ip: "",
    period: "",
    target_date: "",
    skip: 0,
    limit: 1000,
  });

  const debouncedUserId =
    useDebounce(
      filters.user_id,
      400
    );

  const abortRef = useRef(null);


  // =====================================================
  // EMPLOYÉS ACTIFS RELIÉS À UNE POINTEUSE
  // =====================================================

  const fetchEmployees =
    useCallback(async () => {
      try {
        const response =
          await hrClient.get(
            "employees/",
            {
              params: {
                page_size: 5000,
                status: "ACTIVE",
              },
            }
          );

        const employees =
          response.data.results ??
          response.data ??
          [];

        const map = {};

        employees.forEach(
          (employee) => {
            /*
             * Ne pas utiliser employee_id
             * comme valeur de remplacement.
             *
             * Attendance.user_id correspond
             * au device_user_id.
             */
            const deviceUserId =
              Number(
                employee.device_user_id
              );

            if (
              !Number.isFinite(
                deviceUserId
              ) ||
              deviceUserId <= 0
            ) {
              return;
            }

            map[deviceUserId] = {
              name: (
                `${employee.first_name || ""} ` +
                `${employee.last_name || ""}`
              ).trim(),

              empId:
                employee.employee_id,

              factoryName:
                employee.factory_name ||
                "Non assigné",
            };
          }
        );

        setEmployeeMap(map);

        /*
         * Pour les KPI, on compte seulement
         * les employés actifs possédant un
         * identifiant de pointeuse.
         */
        setTotalActive(
          Object.keys(map).length
        );
      } catch (error) {
        console.error(
          "Erreur chargement employés :",
          error
        );

        setEmployeeMap({});
        setTotalActive(null);
      }
    }, []);


  // =====================================================
  // POINTEUSES
  // =====================================================

  const fetchClockers =
    useCallback(async () => {
      try {
        const baseUrl =
          process.env
            .REACT_APP_CLOCKERS_URL ||
          `${window.location.origin}/api/clockers`;

        const response =
          await fetch(
            `${baseUrl}/`
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        setClockers(
          Array.isArray(data)
            ? data
            : []
        );
      } catch (error) {
        console.error(
          "Erreur chargement pointeuses :",
          error
        );
      }
    }, []);


  // =====================================================
  // KPI JOURNALIERS
  // =====================================================

  const fetchKpi =
    useCallback(async () => {
      setKpiLoading(true);

      try {
        const dateKpi =
          formaterDateLocale(
            new Date()
          );

        const kpiData =
          await attendanceService
            .getKpi(dateKpi);

        setKpi(kpiData || {});
      } catch (error) {
        console.error(
          "Erreur KPI :",
          error
        );

        setKpi({});
      } finally {
        setKpiLoading(false);
      }
    }, []);


  // =====================================================
  // DERNIER POINTAGE DU JOUR
  // =====================================================

  const fetchStats =
    useCallback(async () => {
      try {
        const dateKpi =
          formaterDateLocale(
            new Date()
          );

        const params =
          new URLSearchParams();

        /*
         * Ces statistiques alimentent la
         * carte du dernier pointage.
         *
         * Elles doivent toujours concerner
         * la journée actuelle.
         */
        params.append(
          "target_date",
          dateKpi
        );

        const data =
          await attendanceService
            .getStats(
              params.toString()
            );

        setStats(data || {});
      } catch (error) {
        console.error(
          "Erreur statistiques journalières :",
          error
        );

        setStats({});
      }
    }, []);


  // =====================================================
  // TABLEAU DE PRÉSENCE FILTRÉ PAR PÉRIODE
  // =====================================================

  const fetchAttendance =
    useCallback(async () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }

      abortRef.current =
        new AbortController();

      const signal =
        abortRef.current.signal;

      setLoading(true);

      try {
        const pageSize = 1000;

        const buildParams = (
          skip
        ) => {
          const params =
            new URLSearchParams();

          params.append(
            "date_from",
            filters.date_from
          );

          params.append(
            "date_to",
            filters.date_to
          );

          params.append(
            "skip",
            skip
          );

          params.append(
            "limit",
            pageSize
          );

          if (debouncedUserId) {
            params.append(
              "user_id",
              Number(
                debouncedUserId
              )
            );
          }

          if (filters.time_from) {
            params.append(
              "time_from",
              filters.time_from
            );
          }

          if (filters.time_to) {
            params.append(
              "time_to",
              filters.time_to
            );
          }

          if (filters.device_ip) {
            params.append(
              "device_ip",
              filters.device_ip
            );
          }

          return params.toString();
        };

        const {
          data: firstPage,
          totalCount,
        } =
          await attendanceService
            .getGroupedWithCount(
              buildParams(0),
              signal
            );

        let allRows =
          firstPage || [];

        if (
          totalCount &&
          firstPage.length <
            totalCount
        ) {
          const totalPages =
            Math.ceil(
              totalCount /
              pageSize
            );

          const remainingPages =
            await Promise.all(
              Array.from(
                {
                  length:
                    totalPages - 1,
                },
                (_, index) =>
                  attendanceService
                    .getGroupedWithCount(
                      buildParams(
                        (index + 1) *
                        pageSize
                      ),
                      signal
                    )
                    .then(
                      ({ data }) =>
                        data || []
                    )
              )
            );

          allRows = [
            firstPage,
            ...remainingPages,
          ].flat();
        }

        setAttendanceData(
          allRows
        );

        /*
         * Les KPI utilisent leur propre date
         * journalière et ignorent la période
         * du tableau.
         */
        await Promise.all([
          fetchStats(),
          fetchKpi(),
        ]);
      } catch (error) {
        if (
          error.name ===
            "CanceledError" ||
          error.name ===
            "AbortError" ||
          error.code ===
            "ERR_CANCELED"
        ) {
          return;
        }

        console.error(
          "Erreur chargement présences :",
          error
        );
      } finally {
        setLoading(false);
      }
    }, [
      filters.date_from,
      filters.date_to,
      filters.time_from,
      filters.time_to,
      filters.device_ip,
      debouncedUserId,
      fetchStats,
      fetchKpi,
    ]);


  // =====================================================
  // HELPERS
  // =====================================================

  const getEmployeeName = (
    id
  ) =>
    employeeMap[
      Number(id)
    ]?.name || null;

  const getClockerName = (
    ip
  ) =>
    clockers.find(
      (clocker) =>
        clocker.ip_address === ip
    )?.specific_name || ip;


  const exportToExcel = () => {
    const csv =
      attendanceData.map(
        (record) => ({
          id: record.user_id,

          name:
            getEmployeeName(
              record.user_id
            ),

          date:
            record.attendance_date ||
            record.date,

          arrival:
            record.arrival,

          departure:
            record.departure,
        })
      );

    const blob = new Blob(
      [
        JSON.stringify(
          csv
        ),
      ],
      {
        type: "text/csv",
      }
    );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      "attendance.csv";

    link.click();

    URL.revokeObjectURL(
      url
    );
  };


  // =====================================================
  // EFFECTS
  // =====================================================

  useEffect(() => {
    fetchEmployees();
    fetchClockers();
  }, [
    fetchEmployees,
    fetchClockers,
  ]);

  useEffect(() => {
    fetchAttendance();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchAttendance]);


  return {
    state: {
      attendanceData,
      stats,
      kpi,
      totalActive,
      filters,
      loading,
      kpiLoading,
      availableIPs,
      clockers,
      selectedRecord,
      showModal,
      employeeMap,
    },

    actions: {
      setFilters,
      fetchAttendance,
      fetchKpi,
      exportToExcel,
      getEmployeeName,
      getClockerName,
      setSelectedRecord,
      setShowModal,
    },
  };
}