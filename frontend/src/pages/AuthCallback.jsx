import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const access = params.get("access");
    const refresh = params.get("refresh");

    if (access && refresh) {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      window.dispatchEvent(new Event("auth:login"));
      navigate("/dashboard", { replace: true });
    } else {
      setError(true);
      setTimeout(() => navigate("/login?error=entra_failed", { replace: true }), 1500);
    }
  }, [navigate]);

  return (
    <div style={{ textAlign: "center", marginTop: "4rem" }}>
      {error ? "Échec de l'authentification Microsoft…" : "Connexion en cours…"}
    </div>
  );
}
