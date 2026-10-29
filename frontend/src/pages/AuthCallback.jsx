import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    const raw = window.location.hash.replace(/^#/, "") || window.location.search.replace(/^\?/, "");
    const params = new URLSearchParams(raw);
    // Remove tokens from the address bar / history right away
    window.history.replaceState(null, "", window.location.pathname);
    const access = params.get("access");
    const refresh = params.get("refresh");

    if (access && refresh) {
      localStorage.setItem("access_token", access);
      localStorage.setItem("refresh_token", refresh);
      window.dispatchEvent(new Event("auth:login"));
      navigate("/", { replace: true });
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
