import React, { useMemo, useState } from "react";
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

/*
 * Données fictives utilisées pour la présentation au DRH.
 * Elles seront remplacées plus tard par les données de l'API.
 */
const MOCK_DATA = {
  2025: {
    1: {
      mois: [
        { mois: "Janvier", recrutes: 8 },
        { mois: "Février", recrutes: 5 },
        { mois: "Mars", recrutes: 10 },
      ],
      departements: [
        { departement: "Production", demandes: 15, recrutes: 11 },
        { departement: "Qualité", demandes: 8, recrutes: 6 },
        { departement: "Maintenance", demandes: 7, recrutes: 4 },
        { departement: "Logistique", demandes: 6, recrutes: 2 },
        { departement: "Administration", demandes: 4, recrutes: 0 },
      ],
    },

    2: {
      mois: [
        { mois: "Avril", recrutes: 7 },
        { mois: "Mai", recrutes: 12 },
        { mois: "Juin", recrutes: 9 },
      ],
      departements: [
        { departement: "Production", demandes: 18, recrutes: 13 },
        { departement: "Qualité", demandes: 7, recrutes: 5 },
        { departement: "Maintenance", demandes: 10, recrutes: 7 },
        { departement: "Logistique", demandes: 6, recrutes: 3 },
        { departement: "Administration", demandes: 3, recrutes: 0 },
      ],
    },

    3: {
      mois: [
        { mois: "Juillet", recrutes: 11 },
        { mois: "Août", recrutes: 8 },
        { mois: "Septembre", recrutes: 6 },
      ],
      departements: [
        { departement: "Production", demandes: 16, recrutes: 12 },
        { departement: "Qualité", demandes: 9, recrutes: 7 },
        { departement: "Maintenance", demandes: 8, recrutes: 4 },
        { departement: "Logistique", demandes: 5, recrutes: 2 },
        { departement: "Administration", demandes: 4, recrutes: 0 },
      ],
    },

    4: {
      mois: [
        { mois: "Octobre", recrutes: 9 },
        { mois: "Novembre", recrutes: 13 },
        { mois: "Décembre", recrutes: 7 },
      ],
      departements: [
        { departement: "Production", demandes: 20, recrutes: 15 },
        { departement: "Qualité", demandes: 8, recrutes: 6 },
        { departement: "Maintenance", demandes: 9, recrutes: 5 },
        { departement: "Logistique", demandes: 7, recrutes: 3 },
        { departement: "Administration", demandes: 3, recrutes: 0 },
      ],
    },
  },

  2026: {
    1: {
      mois: [
        { mois: "Janvier", recrutes: 12 },
        { mois: "Février", recrutes: 9 },
        { mois: "Mars", recrutes: 14 },
      ],
      departements: [
        { departement: "Production", demandes: 22, recrutes: 17 },
        { departement: "Qualité", demandes: 10, recrutes: 8 },
        { departement: "Maintenance", demandes: 12, recrutes: 7 },
        { departement: "Logistique", demandes: 8, recrutes: 3 },
        { departement: "Administration", demandes: 5, recrutes: 0 },
      ],
    },

    2: {
      mois: [
        { mois: "Avril", recrutes: 10 },
        { mois: "Mai", recrutes: 16 },
        { mois: "Juin", recrutes: 11 },
      ],
      departements: [
        { departement: "Production", demandes: 25, recrutes: 19 },
        { departement: "Qualité", demandes: 12, recrutes: 9 },
        { departement: "Maintenance", demandes: 10, recrutes: 6 },
        { departement: "Logistique", demandes: 9, recrutes: 3 },
        { departement: "Administration", demandes: 4, recrutes: 0 },
      ],
    },

    3: {
      mois: [
        { mois: "Juillet", recrutes: 13 },
        { mois: "Août", recrutes: 15 },
        { mois: "Septembre", recrutes: 8 },
      ],
      departements: [
        { departement: "Production", demandes: 24, recrutes: 18 },
        { departement: "Qualité", demandes: 11, recrutes: 7 },
        { departement: "Maintenance", demandes: 13, recrutes: 8 },
        { departement: "Logistique", demandes: 8, recrutes: 3 },
        { departement: "Administration", demandes: 5, recrutes: 0 },
      ],
    },

    4: {
      mois: [
        { mois: "Octobre", recrutes: 0 },
        { mois: "Novembre", recrutes: 0 },
        { mois: "Décembre", recrutes: 0 },
      ],
      departements: [
        { departement: "Production", demandes: 0, recrutes: 0 },
        { departement: "Qualité", demandes: 0, recrutes: 0 },
        { departement: "Maintenance", demandes: 0, recrutes: 0 },
        { departement: "Logistique", demandes: 0, recrutes: 0 },
        { departement: "Administration", demandes: 0, recrutes: 0 },
      ],
    },
  },
};

const TRIMESTRES = [
  { value: "1", label: "1er trimestre" },
  { value: "2", label: "2e trimestre" },
  { value: "3", label: "3e trimestre" },
  { value: "4", label: "4e trimestre" },
];

function StatCard({ title, value, subtitle, icon: Icon, color }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {value}
          </p>

          <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
        </div>

        <div className={`rounded-xl p-3 ${color}`}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
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
          <span style={{ color: item.color }}>{item.name}</span>

          <span className="font-semibold text-slate-900">
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardRecrutement() {
  const [annee, setAnnee] = useState("2026");
  const [trimestre, setTrimestre] = useState("3");

  const donnees = useMemo(() => {
    return MOCK_DATA[annee]?.[trimestre] ?? {
      mois: [],
      departements: [],
    };
  }, [annee, trimestre]);

  const departementsAvecEcart = useMemo(() => {
    return donnees.departements.map((item) => ({
      ...item,
      ecart: item.demandes - item.recrutes,
    }));
  }, [donnees.departements]);

  const indicateurs = useMemo(() => {
    const totalRecrutes = donnees.mois.reduce(
      (total, item) => total + item.recrutes,
      0
    );

    const totalDemandes = donnees.departements.reduce(
      (total, item) => total + item.demandes,
      0
    );

    const totalEcart = departementsAvecEcart.reduce(
      (total, item) => total + item.ecart,
      0
    );

    return {
      totalRecrutes,
      totalDemandes,
      totalEcart,
      departements: donnees.departements.length,
    };
  }, [donnees, departementsAvecEcart]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
      {/* En-tête */}
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Tableau de bord du recrutement
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Suivi trimestriel des besoins et des recrutements réalisés
          </p>
        </div>

        {/* Filtres */}
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-slate-500" />

            <select
              value={annee}
              onChange={(event) => setAnnee(event.target.value)}
              className="min-w-[110px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              {Object.keys(MOCK_DATA)
                .sort((a, b) => b - a)
                .map((item) => (
                  <option key={item} value={item}>
                    Année {item}
                  </option>
                ))}
            </select>
          </div>

          <select
            value={trimestre}
            onChange={(event) => setTrimestre(event.target.value)}
            className="min-w-[170px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {TRIMESTRES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Indicateurs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Besoins exprimés"
          value={indicateurs.totalDemandes}
          subtitle="Postes demandés"
          icon={BriefcaseBusiness}
          color="bg-blue-100 text-blue-700"
        />

        <StatCard
          title="Personnes recrutées"
          value={indicateurs.totalRecrutes}
          subtitle="Recrutements réalisés"
          icon={TrendingUp}
          color="bg-emerald-100 text-emerald-700"
        />

        <StatCard
          title="Écart total"
          value={indicateurs.totalEcart}
          subtitle="Postes restant à pourvoir"
          icon={Building2}
          color="bg-orange-100 text-orange-700"
        />

        <StatCard
          title="Départements concernés"
          value={indicateurs.departements}
          subtitle="Départements demandeurs"
          icon={Building2}
          color="bg-violet-100 text-violet-700"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Nombre de recrutements par mois */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">
              Nombre de recrutements par mois
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Recrutements réalisés pendant le trimestre sélectionné
            </p>
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
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
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#f1f5f9" }}
                />

                <Bar
                  dataKey="recrutes"
                  name="Personnes recrutées"
                  fill="#2563eb"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={65}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Écart par département */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5">
            <h2 className="font-semibold text-slate-900">
              Écart par département
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Nombre demandé moins nombre recruté
            </p>
          </div>

          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={departementsAvecEcart}
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
                  tick={{ fill: "#64748b", fontSize: 11 }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#64748b", fontSize: 12 }}
                />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: "#f1f5f9" }}
                />

                <Legend
                  verticalAlign="top"
                  align="right"
                  wrapperStyle={{
                    paddingBottom: "20px",
                    fontSize: "12px",
                  }}
                />

                <Bar
                  dataKey="demandes"
                  name="Nombre demandé"
                  fill="#94a3b8"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />

                <Bar
                  dataKey="recrutes"
                  name="Nombre recruté"
                  fill="#16a34a"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />

                <Bar
                  dataKey="ecart"
                  name="Écart"
                  fill="#f97316"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}