// import React, { useState } from "react";
// import "./LoginPage.css";
// import { login } from "../api/auth";
// import { useNavigate } from "react-router-dom";
// import { Eye, EyeOff } from "lucide-react";
// import loginImage from "../../src/assets/loginpic.jpeg"

// const LoginPage = () => {
//   const [username, setUsername] = useState("");
//   const [password, setPassword] = useState("");
//   const [error, setError] = useState("");
//   const [loading, setLoading] = useState(false);

//   const navigate = useNavigate();
//   const [showPassword, setShowPassword] = useState(false);

//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     setLoading(true);
//     setError("");

//     const success = await login(username, password);

//     setLoading(false);

//     if (success) navigate("/");
//     else setError("Identifiants incorrects.");
//   };

//   return (
//     <div className="login-page">

//       <div className="login-image">
//         <img src={loginImage} alt="HR" />
//       </div>

//       <div className="login-panel">

//         <div className="login-logo">
//           <h1>Systeme RH</h1>
//           <p>Système de Gestion RH</p>
//         </div>

//         <form className="login-card" onSubmit={handleSubmit}>

//           <span>Connectez-vous à votre espace</span>

//           {error && <div className="error">{error}</div>}

//           <input
//             type="text"
//             placeholder="Nom d'utilisateur"
//             value={username}
//             onChange={(e)=>setUsername(e.target.value)}
//           />

//           <div className="password-field">
//             <input
//               type={showPassword ? "text" : "password"}
//               placeholder="Mot de passe"
//               value={password}
//               onChange={(e) => setPassword(e.target.value)}
//             />

//             <button
//               type="button"
//               className="password-toggle"
//               onClick={() => setShowPassword(!showPassword)}
//               aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
//             >
//               {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
//             </button>
//           </div>
          
//           <button disabled={loading}>
//             {loading ? "Connexion..." : "Se connecter"}
//           </button>

//         </form>

//         <small>© 2026 Tecma</small>

//       </div>

//     </div>
//   );
// };

// export default LoginPage;









import React, { useState } from "react";
import "./LoginPage.css";
import { login } from "../api/auth";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, User, Lock } from "lucide-react";
import loginIllustration from "../assets/image.jpg";

const LoginPage = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const success = await login(username, password, rememberMe);

    setLoading(false);

    if (success) navigate("/");
    else setError("Identifiants incorrects.");
  };

  return (
    <div className="login-page">
      <div className="login-card">

        {/* ── Panneau visuel : illustration statique ── */}
        <div className="login-visual" aria-hidden="true">

          <div className="visual-image">
            <img src={loginIllustration} alt="Illustration du suivi de présence" />
          </div>

          <div className="visual-caption">
            <p className="eyebrow">Suivi en temps réel</p>
            <h2>Chaque pointage, chaque personnel,<br />une vue d'ensemble.</h2>
            <p className="body">
              Centralisez la gestion des ressources humaines de toutes les usines
              dans un seul tableau de bord, mis à jour en direct.
            </p>
          </div>
        </div>

        {/* ── Panneau formulaire ── */}
        <div className="login-panel">
          <form className="login-form" onSubmit={handleSubmit}>

            <p className="eyebrow">SYSTEME RH</p>

            {error && <div className="error">{error}</div>}

            <div className="field">
              <label htmlFor="username">Nom d'utilisateur</label>
              <User className="field-icon" size={18} strokeWidth={1.75} />
              <input
                id="username"
                type="text"
                placeholder="ex. jrakoto"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="field">
              <label htmlFor="password">Mot de passe</label>
              <Lock className="field-icon" size={18} strokeWidth={1.75} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              >
                {showPassword ? <EyeOff size={18} strokeWidth={1.75} /> : <Eye size={18} strokeWidth={1.75} />}
              </button>
            </div>

            <button className="submit-btn" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>

          </form>

          <div className="entra-login">
            <span className="entra-divider">ou</span>
            
            <a
              href={`${process.env.REACT_APP_AUTH_URL}/entra/login/`}
              className="entra-btn"
            >
              Se connecter avec Microsoft
            </a>
          </div>

          <small className="login-footer">© 2026 Paul Boyé Industries</small>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
