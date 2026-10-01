import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  TrendingUp,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";


const TRIMESTRES = [
  {
    value: "1",
    label: "1er trimestre",
  },
  {
    value: "2",
    label: "2e trimestre",
  },
  {
    value: "3",
    label: "3e trimestre",
  },
  {
    value: "4",
    label: "4e trimestre",
  },
];


function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">
            {title}
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            {subtitle}
          </p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}


function CustomTooltip({
  active,
  payload,
  label,
}) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {label}
      </p>

      {payload.map((item) => (
        <div
          key={item.dataKey}
          className="flex min-w-[180px] items-center justify-between gap-5 text-sm"
        >
          <span
            style={{
              color: item.color,
            }}
          >
            {item.name}
          </span>

          <span className="font-semibold text-slate-900">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}


function GraphiqueVide({
  message = "Aucune donnée disponible pour cette période.",
}) {
  return (
    <div className="flex h-[340px] items-center justify-center rounded-lg bg-slate-50">
      <p className="text-center text-sm text-slate-500">
        {message}
      </p>
    </div>
  );
}


export default function DashboardRecrutement() {
  const maintenant = new Date();

  const anneeActuelle =
    maintenant.getFullYear();

  const trimestreActuel =
    Math.floor(
      maintenant.getMonth() / 3
    ) + 1;

  const [annee, setAnnee] = useState(
    String(anneeActuelle)
  );

  const [
    trimestre,
    setTrimestre,
  ] = useState(
    String(trimestreActuel)
  );

  const [
    donnees,
    setDonnees,
  ] = useState({
    mois: [],
    departements: [],
    indicateurs: {
      total_demandes: 0,
      total_recrutes: 0,
      total_ecart: 0,
      total_departements: 0,
    },
  });

  const [
    chargement,
    setChargement,
  ] = useState(true);

  const [
    erreur,
    setErreur,
  ] = useState("");


  useEffect(() => {
    let composantActif = true;

    const chargerTableauDeBord =
      async () => {
        setChargement(true);
        setErreur("");

        try {
          const resultat =
            await recrutementApi
              .obtenirTableauDeBord({
                annee: Number(annee),
                trimestre:
                  Number(trimestre),
              });

          if (composantActif) {
            setDonnees({
              mois:
                resultat?.mois || [],

              departements:
                resultat?.departements ||
                [],

              indicateurs: {
                total_demandes:
                  resultat
                    ?.indicateurs
                    ?.total_demandes ??
                  0,

                total_recrutes:
                  resultat
                    ?.indicateurs
                    ?.total_recrutes ??
                  0,

                total_ecart:
                  resultat
                    ?.indicateurs
                    ?.total_ecart ??
                  0,

                total_departements:
                  resultat
                    ?.indicateurs
                    ?.total_departements ??
                  0,
              },
            });
          }
        } catch (error) {
          if (!composantActif) {
            return;
          }

          const message =
            typeof recrutementApi
              .extraireErreur ===
            "function"
              ? recrutementApi
                  .extraireErreur(error)
              : (
                  error?.response?.data
                    ?.detail ||
                  "Impossible de charger les statistiques."
                );

          setErreur(message);

          setDonnees({
            mois: [],
            departements: [],
            indicateurs: {
              total_demandes: 0,
              total_recrutes: 0,
              total_ecart: 0,
              total_departements: 0,
            },
          });
        } finally {
          if (composantActif) {
            setChargement(false);
          }
        }
      };

    chargerTableauDeBord();

    return () => {
      composantActif = false;
    };
  }, [annee, trimestre]);


  const anneesDisponibles =
    useMemo(
      () =>
        Array.from(
          {
            length: 6,
          },
          (_, index) =>
            anneeActuelle - index
        ),
      [anneeActuelle]
    );


  const departementsAvecEcart =
    useMemo(
      () =>
        donnees.departements.map(
          (item) => {
            const demandes =
              Number(
                item.demandes
              ) || 0;

            const recrutes =
              Number(
                item.recrutes
              ) || 0;

            return {
              ...item,
              demandes,
              recrutes,
              ecart:
                item.ecart ??
                Math.max(
                  demandes - recrutes,
                  0
                ),
            };
          }
        ),
      [donnees.departements]
    );


  const indicateurs = useMemo(
    () => ({
      totalDemandes:
        donnees.indicateurs
          ?.total_demandes ?? 0,

      totalRecrutes:
        donnees.indicateurs
          ?.total_recrutes ?? 0,

      totalEcart:
        donnees.indicateurs
          ?.total_ecart ?? 0,

      departements:
        donnees.indicateurs
          ?.total_departements ??
        donnees.departements.length,
    }),
    [
      donnees.indicateurs,
      donnees.departements.length,
    ]
  );


  const moisAvecDonnees =
    donnees.mois.some(
      (item) =>
        Number(item.recrutes) > 0
    );

  const departementsAvecDonnees =
    departementsAvecEcart.length > 0;


  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Tableau de bord du recrutement
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Suivi trimestriel des besoins
            et des recrutements réalisés
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
          <div className="flex items-center gap-2">
            <CalendarDays
              size={18}
              className="text-slate-500"
            />

            <select
              value={annee}
              onChange={(event) =>
                setAnnee(
                  event.target.value
                )
              }
              disabled={chargement}
              className="min-w-[120px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {anneesDisponibles.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    Année {item}
                  </option>
                )
              )}
            </select>
          </div>

          <select
            value={trimestre}
            onChange={(event) =>
              setTrimestre(
                event.target.value
              )
            }
            disabled={chargement}
            className="min-w-[170px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {TRIMESTRES.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              )
            )}
          </select>
        </div>
      </div>

      {erreur && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {erreur}
        </div>
      )}

      {chargement && (
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          Chargement des statistiques…
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Besoins exprimés"
          value={
            indicateurs.totalDemandes
          }
          subtitle="Postes demandés"
          icon={BriefcaseBusiness}
          color="bg-blue-100 text-blue-700"
        />

        <StatCard
          title="Personnes recrutées"
          value={
            indicateurs.totalRecrutes
          }
          subtitle="Recrutements réalisés"
          icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          title="Écart total"
          value={
            indicateurs.totalEcart
          }
          subtitle="Postes restant à pourvoir"
          icon={Building2}
          color="bg-orange-100 text-orange-700"
        />

        <StatCard
          title="Départements concernés"
          value={
            indicateurs.departements
          }
          subtitle="Départements demandeurs"
          icon={Building2}
          color="bg-violet-100 text-violet-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">
              Nombre de recrutements
              par mois
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recrutements réalisés
              pendant le trimestre
              sélectionné
            </p>
          </div>

          {!chargement &&
          !moisAvecDonnees ? (
            <GraphiqueVide />
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={donnees.mois}
                  margin={{
                    top: 10,
                    right: 10,
                    left: -15,
                    bottom: 10,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="mois"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                  />

                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                  />

                  <Tooltip
                    content={
                      <CustomTooltip />
                    }
                    cursor={{
                      fill: "#f1f5f9",
                    }}
                  />

                  <Bar
                    dataKey="recrutes"
                    name="Personnes recrutées"
                    fill="#2563eb"
                    radius={[
                      6,
                      6,
                      0,
                      0,
                    ]}
                    maxBarSize={65}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">
              Écart par département
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Nombre demandé moins nombre
              recruté
            </p>
          </div>

          {!chargement &&
          !departementsAvecDonnees ? (
            <GraphiqueVide />
          ) : (
            <div className="h-[340px] w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={
                    departementsAvecEcart
                  }
                  margin={{
                    top: 10,
                    right: 10,
                    left: -15,
                    bottom: 45,
                  }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="#e2e8f0"
                  />

                  <XAxis
                    dataKey="departement"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={70}
                    tick={{
                      fill: "#64748b",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#64748b",
                      fontSize: 12,
                    }}
                  />

                  <Tooltip
                    content={
                      <CustomTooltip />
                    }
                    cursor={{
                      fill: "#f1f5f9",
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    align="right"
                    wrapperStyle={{
                      paddingBottom:
                        "20px",
                      fontSize: "12px",
                    }}
                  />

                  <Bar
                    dataKey="demandes"
                    name="Nombre demandé"
                    fill="#94a3b8"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                    maxBarSize={32}
                  />

                  <Bar
                    dataKey="recrutes"
                    name="Nombre recruté"
                    fill="#16a34a"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                    maxBarSize={32}
                  />

                  <Bar
                    dataKey="ecart"
                    name="Écart"
                    fill="#f97316"
                    radius={[
                      5,
                      5,
                      0,
                      0,
                    ]}
                    maxBarSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}