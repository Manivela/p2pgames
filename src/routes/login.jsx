import { useNavigate, useLocation } from "react-router-dom";
import { useDoc } from "../vendor/y-react";
import { newUser, useAuthStore } from "../hooks/useStore";
import { customNanoid } from "../utils/customNanoid";
import { t } from "../i18n";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const login = useAuthStore((state) => state.login);
  const doc = useDoc();

  if (currentUser) {
    const from = location.state?.from?.pathname;
    const roomId = customNanoid(4);
    const targetPath = from || `/${roomId}`;

    setTimeout(() => {
      // a new room's game, so its first page needn't wait to hear it
      // (root.jsx)
      if (!from) doc.getMap("room").set("game", "okey");
      navigate(targetPath, { replace: true });
    }, 0);

    return <div>Loading...</div>;
  }

  const handleLogin = (event) => {
    event.preventDefault();
    const username = event.target.username.value;
    if (!username.trim()) return;

    login(newUser(username));
  };

  return (
    <div className="centered">
      {t("User:")}{" "}
      <form onSubmit={handleLogin}>
        <input name="username" required />
        <button type="submit">{t("Go")}</button>
      </form>
    </div>
  );
}
