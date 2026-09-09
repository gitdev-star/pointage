import React, { useEffect, useState } from "react";
import EmployeeSearch from "./EmployeSearch";

const EMPTY_FORM = {
  employee: "",
  leave_type: "",
  start_date: "",
  end_date: "",
  days_requested: "",
  start_time: "",
  end_time: "",
  reason: "",
};

const labelSt = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "#616161",
  marginBottom: 4,
};

const inputSt = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid #e0e0e0",
  fontSize: 13,
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
  color: "#212121",
  fontFamily: "inherit",
};

const errorSt = {
  fontSize: 11,
  color: "#d32f2f",
  marginTop: 3,
};

const helperSt = {
  fontSize: 11,
  color: "#9e9e9e",
  marginTop: 3,
};

export default function EvenementModal({
  open,
  onClose,
  leaveTypes = [],
  onSave,
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const selectedType = leaveTypes.find(
    (type) => Number(type.id) === Number(form.leave_type)
  );

  const isHourly = selectedType?.code === "PM";

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM);
      setFormErrors({});
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (isHourly) return;

    if (form.start_date && form.end_date) {
      const start = new Date(`${form.start_date}T00:00:00`);
      const end = new Date(`${form.end_date}T00:00:00`);

      if (end >= start) {
        const millisecondsPerDay = 1000 * 60 * 60 * 24;
        const days =
          Math.floor((end - start) / millisecondsPerDay) + 1;

        setForm((previous) => ({
          ...previous,
          days_requested: days,
        }));
      }
    }
  }, [form.start_date, form.end_date, isHourly]);

  useEffect(() => {
    setForm((previous) => {
      if (isHourly) {
        return {
          ...previous,
          end_date: previous.start_date,
          days_requested: 1,
        };
      }

      return {
        ...previous,
        start_time: "",
        end_time: "",
      };
    });

    setFormErrors({});
  }, [isHourly]);

  useEffect(() => {
    if (isHourly && form.start_date) {
      setForm((previous) => ({
        ...previous,
        end_date: form.start_date,
        days_requested: 1,
      }));
    }
  }, [isHourly, form.start_date]);

  const handleFieldChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));

    setFormErrors((previous) => ({
      ...previous,
      [field]: undefined,
      non_field_errors: undefined,
    }));
  };

  const handleSave = async () => {
    const errors = {};

    if (!form.employee) {
      errors.employee = "Requis";
    }

    if (!form.leave_type) {
      errors.leave_type = "Requis";
    }

    if (!form.start_date) {
      errors.start_date = "Requis";
    }

    if (!isHourly && !form.end_date) {
      errors.end_date = "Requis";
    }

    if (!isHourly && !form.days_requested) {
      errors.days_requested = "Requis";
    }

    if (isHourly) {
      if (!form.start_time) {
        errors.start_time = "L’heure de début est requise.";
      }

      if (!form.end_time) {
        errors.end_time = "L’heure de fin est requise.";
      }

      if (
        form.start_time &&
        form.end_time &&
        form.end_time <= form.start_time
      ) {
        errors.end_time =
          "L’heure de fin doit être après l’heure de début.";
      }
    }

    if (
      !isHourly &&
      form.start_date &&
      form.end_date &&
      form.end_date < form.start_date
    ) {
      errors.end_date =
        "La date de fin doit être après la date de début.";
    }

    setFormErrors(errors);

    if (Object.keys(errors).length > 0) {
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,
        employee: Number(form.employee),
        leave_type: Number(form.leave_type),
      };

      if (isHourly) {
        payload.end_date = payload.start_date;
        payload.days_requested = 1;
      } else {
        delete payload.start_time;
        delete payload.end_time;
      }

      await onSave(payload);
    } catch (error) {
      const data = error.response?.data;

      if (data && typeof data === "object") {
        setFormErrors(data);
      } else {
        setFormErrors({
          non_field_errors:
            "Une erreur est survenue pendant l’enregistrement.",
        });
      }
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1300,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          padding: "28px 32px",
          width: "100%",
          maxWidth: 480,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <h2
          style={{
            fontSize: 17,
            fontWeight: 700,
            margin: "0 0 20px",
            color: "#212121",
          }}
        >
          Nouvel événement
        </h2>

        {formErrors.non_field_errors && (
          <div
            style={{
              ...errorSt,
              marginBottom: 14,
              padding: 10,
              borderRadius: 8,
              background: "#ffebee",
            }}
          >
            {Array.isArray(formErrors.non_field_errors)
              ? formErrors.non_field_errors.join(" ")
              : formErrors.non_field_errors}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Employé *</label>

          <EmployeeSearch
            value={form.employee}
            onChange={(id) => handleFieldChange("employee", id)}
            error={Boolean(formErrors.employee)}
          />

          {formErrors.employee && (
            <div style={errorSt}>{formErrors.employee}</div>
          )}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelSt}>Type d’événement *</label>

          <select
            value={form.leave_type}
            onChange={(event) =>
              handleFieldChange(
                "leave_type",
                Number(event.target.value) || ""
              )
            }
            style={{
              ...inputSt,
              border: formErrors.leave_type
                ? "1px solid #d32f2f"
                : inputSt.border,
            }}
          >
            <option value="">-- Sélectionner --</option>

            {leaveTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} (
                {type.days_per_year > 0
                  ? `${type.days_per_year}j/an`
                  : "illimité"}
                )
              </option>
            ))}
          </select>

          {formErrors.leave_type && (
            <div style={errorSt}>{formErrors.leave_type}</div>
          )}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isHourly ? "1fr" : "1fr 1fr",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={labelSt}>
              {isHourly ? "Date *" : "Date de début *"}
            </label>

            <input
              type="date"
              value={form.start_date}
              onChange={(event) =>
                handleFieldChange("start_date", event.target.value)
              }
              style={{
                ...inputSt,
                border: formErrors.start_date
                  ? "1px solid #d32f2f"
                  : inputSt.border,
              }}
            />

            {formErrors.start_date && (
              <div style={errorSt}>{formErrors.start_date}</div>
            )}
          </div>

          {!isHourly && (
            <div>
              <label style={labelSt}>Date de fin *</label>

              <input
                type="date"
                min={form.start_date || undefined}
                value={form.end_date}
                onChange={(event) =>
                  handleFieldChange("end_date", event.target.value)
                }
                style={{
                  ...inputSt,
                  border: formErrors.end_date
                    ? "1px solid #d32f2f"
                    : inputSt.border,
                }}
              />

              {formErrors.end_date && (
                <div style={errorSt}>{formErrors.end_date}</div>
              )}
            </div>
          )}
        </div>

        {isHourly ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <label style={labelSt}>Heure de début *</label>

              <input
                type="time"
                step={60}
                value={form.start_time}
                onChange={(event) =>
                  handleFieldChange("start_time", event.target.value)
                }
                style={{
                  ...inputSt,
                  border: formErrors.start_time
                    ? "1px solid #d32f2f"
                    : inputSt.border,
                }}
              />

              {formErrors.start_time && (
                <div style={errorSt}>{formErrors.start_time}</div>
              )}
            </div>

            <div>
              <label style={labelSt}>Heure de fin *</label>

              <input
                type="time"
                step={60}
                value={form.end_time}
                onChange={(event) =>
                  handleFieldChange("end_time", event.target.value)
                }
                style={{
                  ...inputSt,
                  border: formErrors.end_time
                    ? "1px solid #d32f2f"
                    : inputSt.border,
                }}
              />

              {formErrors.end_time && (
                <div style={errorSt}>{formErrors.end_time}</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ marginBottom: 14 }}>
            <label style={labelSt}>Jours demandés *</label>

            <input
              type="number"
              min={0.5}
              step={0.5}
              value={form.days_requested}
              onChange={(event) =>
                handleFieldChange(
                  "days_requested",
                  event.target.value
                )
              }
              style={{
                ...inputSt,
                border: formErrors.days_requested
                  ? "1px solid #d32f2f"
                  : inputSt.border,
              }}
            />

            <div
              style={
                formErrors.days_requested ? errorSt : helperSt
              }
            >
              {formErrors.days_requested ||
                "Calculé automatiquement"}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={labelSt}>Motif</label>

          <textarea
            rows={3}
            value={form.reason}
            onChange={(event) =>
              handleFieldChange("reason", event.target.value)
            }
            style={{
              ...inputSt,
              resize: "vertical",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "8px 18px",
              borderRadius: 8,
              border: "1px solid #e0e0e0",
              background: "#fafafa",
              fontSize: 13,
              cursor: "pointer",
              color: "#424242",
            }}
          >
            Annuler
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: "8px 20px",
              borderRadius: 8,
              border: "none",
              background: "#1976d2",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving
              ? "Enregistrement..."
              : "Créer l’événement"}
          </button>
        </div>
      </div>
    </div>
  );
}