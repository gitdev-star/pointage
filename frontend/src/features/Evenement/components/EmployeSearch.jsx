import React, { useRef, useState } from "react";
import hrClient from "../../../api/hrClient";

export default function EmployeeSearch({
  value,
  onChange,
  error = false,
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");

  const debounceRef = useRef(null);

  const searchEmployees = (searchValue) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!searchValue) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setLoading(true);

        const response = await hrClient.get(
          "employees/",
          {
            params: {
              search: searchValue,
              page_size: 30,
              status: "ACTIVE",
            },
          }
        );

        setResults(
          response.data.results ?? response.data
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        value={selectedLabel || query}
        placeholder="Nom, prénom ou matricule..."
        onFocus={() => setOpen(true)}
        onBlur={() =>
          setTimeout(() => setOpen(false), 200)
        }
        onChange={(e) => {
          const value = e.target.value;

          setQuery(value);
          setSelectedLabel("");

          onChange("");

          searchEmployees(value);

          setOpen(true);
        }}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: error
            ? "1px solid #d32f2f"
            : "1px solid #ddd",
        }}
      />

      {open && (
        <div
          style={{
            position: "absolute",
            width: "100%",
            background: "#fff",
            border: "1px solid #ddd",
            borderRadius: 8,
            marginTop: 2,
            zIndex: 999,
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {loading && (
            <div style={{ padding: 10 }}>
              Recherche...
            </div>
          )}

          {!loading &&
            results.map((employee) => (
              <div
                key={employee.id}
                onMouseDown={() => {
                  onChange(employee.id);

                  setSelectedLabel(
                    `${employee.last_name} ${employee.first_name}`
                  );

                  setQuery("");
                  setOpen(false);
                }}
                style={{
                  padding: 10,
                  cursor: "pointer",
                }}
              >
                <strong>
                  {employee.last_name}{" "}
                  {employee.first_name}
                </strong>

                <span
                  style={{
                    marginLeft: 8,
                    color: "#999",
                  }}
                >
                  {employee.employee_id}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}