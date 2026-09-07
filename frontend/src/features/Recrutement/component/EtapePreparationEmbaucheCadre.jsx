import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Loader2,
  Mail,
  RefreshCw,
  Save,
} from "lucide-react";

import recrutementApi from "../../../api/recrutementApi";

const SERVICES = {
  IT: {
    label: "Service IT",
    couleur:
      "border-blue-200 bg-blue-50 text-blue-700",
  },
  COMPTABILITE: {
    label: "Comptabilité",
    couleur:
      "border-amber-200 bg-amber-50 text-amber-700",
  },
  RH: {
    label: "Responsable RH",
    couleur:
      "border-violet-200 bg-violet-50 text-violet-700",
  },
};

function formatDate(date) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(date));
}

export default function EtapePreparationEmbaucheCadre({
  recrutement,
  onComplete,
}) {
  const processusId = recrutement?.id;

  const [taches, setTaches] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [actionEnCours, setActionEnCours] = useState(null);
  const [erreur, setErreur] = useState("");
  const [message, setMessage] = useState("");

  const chargerTaches = useCallback(async () => {
    if (!processusId) {
      setErreur("L’identifiant du processus est absent.");
      setChargement(false);
      return;
    }

    setChargement(true);
    setErreur("");

    try {
      const resultat =
        await recrutementApi.obtenirTachesPreparation(
          processusId
        );

      setTaches(resultat?.taches || []);
    } catch (error) {
      setErreur(recrutementApi.extraireErreur(error));
    } finally {
      setChargement(false);
    }
  }, [processusId]);

  useEffect(() => {
    chargerTaches();
  }, [chargerTaches]);

  const candidats = useMemo(() => {
    const groupes = {};

    taches.forEach((tache) => {
      if (!groupes[tache.candidat]) {
        groupes[tache.candidat] = {
          id: tache.candidat,
          nom: tache.candidat_nom,
          reference: tache.reference_recrutement,
          poste: tache.poste,
          taches: [],
        };
      }

      groupes[tache.candidat].taches.push(tache);
    });

    return Object.values(groupes);
  }, [taches]);

  const toutesNotificationsEnvoyees =
    taches.length > 0 &&
    taches.every(
      (tache) => tache.notification_email_envoyee
    );

  const renvoyerNotification = async (tache) => {
    const cleAction = `notification-${tache.id}`;

    setActionEnCours(cleAction);
    setErreur("");
    setMessage("");

    try {
      const resultat =
        await recrutementApi.renvoyerNotificationPreparation(
          tache.id
        );

      setMessage(
        resultat?.message ||
          "La notification a été envoyée."
      );

      await chargerTaches();
    } catch (error) {
      setErreur(recrutementApi.extraireErreur(error));
    } finally {
      setActionEnCours(null);
    }
  };

  const terminerEtape = async () => {
    if (!toutesNotificationsEnvoyees) {
      setErreur(
        "Toutes les notifications doivent être envoyées avant de terminer l’étape."
      );
      return;
    }

    setActionEnCours("terminer-etape");
    setErreur("");
    setMessage("");

    try {
      const resultat =
        await recrutementApi.terminerEtapeProcessus(
          processusId,
          4
        );

      setMessage(
        resultat?.message ||
          "L’étape de préparation a été terminée."
      );

      onComplete?.({
        etape: 4,
        processus: resultat?.processus,
      });
    } catch (error) {
      setErreur(recrutementApi.extraireErreur(error));
    } finally {
      setActionEnCours(null);
    }
  };

  if (chargement) {
    return (
      <div className="flex min-h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <Loader2
          size={28}
          className="animate-spin text-blue-600"
        />

        <span className="ml-3 text-sm text-slate-600">
          Chargement des demandes de préparation...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-bold text-slate-900">
          Préparation de l’embauche
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Vérifiez l’envoi des demandes aux services IT,
          Comptabilité et Ressources humaines.
        </p>
      </header>

      {erreur && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />
          <span>{erreur}</span>
        </div>
      )}

      {message && (
        <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          <CheckCircle2
            size={18}
            className="mt-0.5 shrink-0"
          />
          <span>{message}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={chargerTaches}
          disabled={chargement || Boolean(actionEnCours)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={16} />
          Actualiser
        </button>
      </div>

      {candidats.map((candidat) => (
        <section
          key={candidat.id}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 bg-slate-50 p-5">
            <h3 className="font-bold text-slate-900">
              {candidat.nom}
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              {candidat.poste} — {candidat.reference}
            </p>
          </div>

          <div className="space-y-6 p-5">
            {Object.entries(SERVICES).map(
              ([codeService, service]) => {
                const tachesService =
                  candidat.taches.filter(
                    (tache) =>
                      tache.service === codeService
                  );

                if (tachesService.length === 0) {
                  return null;
                }

                const notificationEnvoyee =
                  tachesService.every(
                    (tache) =>
                      tache.notification_email_envoyee
                  );

                const premiereTache = tachesService[0];
                const cleNotification =
                  `notification-${premiereTache.id}`;

                return (
                  <div
                    key={codeService}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="flex flex-col justify-between gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center">
                      <div>
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold ${service.couleur}`}
                        >
                          {service.label}
                        </span>

                        {notificationEnvoyee ? (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 size={14} />
                            Notification envoyée le{" "}
                            {formatDate(
                              premiereTache
                                .date_notification_email
                            )}
                          </p>
                        ) : (
                          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600">
                            <AlertCircle size={14} />
                            Notification non envoyée
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          renvoyerNotification(
                            premiereTache
                          )
                        }
                        disabled={Boolean(actionEnCours)}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                      >
                        {actionEnCours ===
                        cleNotification ? (
                          <Loader2
                            size={15}
                            className="animate-spin"
                          />
                        ) : (
                          <Mail size={15} />
                        )}

                        {notificationEnvoyee
                          ? "Renvoyer l’e-mail"
                          : "Envoyer l’e-mail"}
                      </button>
                    </div>

                    <div className="divide-y divide-slate-200">
                      {tachesService.map((tache) => (
                        <div
                          key={tache.id}
                          className="flex items-start gap-3 p-4"
                        >
                          <div className="mt-0.5 rounded-lg bg-slate-100 p-2 text-slate-600">
                            <FileCheck2 size={16} />
                          </div>

                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {tache.libelle}
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              Demande transmise au{" "}
                              {service.label}.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </section>
      ))}

      {candidats.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center">
          <AlertCircle
            size={28}
            className="mx-auto text-amber-600"
          />

          <p className="mt-3 font-semibold text-amber-900">
            Aucune demande de préparation
          </p>

          <p className="mt-1 text-sm text-amber-700">
            Les demandes apparaîtront lorsqu’un compte
            rendu cadre favorable aura été validé.
          </p>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={terminerEtape}
          disabled={
            !toutesNotificationsEnvoyees ||
            Boolean(actionEnCours)
          }
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {actionEnCours === "terminer-etape" ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <Save size={17} />
          )}

          Terminer la préparation
        </button>
      </div>
    </div>
  );
}
