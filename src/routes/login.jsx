import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../hooks/useStore";
import { customNanoid } from "../utils/customNanoid";

const colors = ["red", "green", "blue", "orange", "yellow"];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useAuthStore((state) => state.currentUser);
  const login = useAuthStore((state) => state.login);

  if (currentUser) {
    const from = location.state?.from?.pathname;
    const roomId = customNanoid(6);
    const targetPath = from || `/${roomId}/okey`;

    setTimeout(() => {
      navigate(targetPath, { replace: true });
    }, 0);

    return <div>Loading...</div>;
  }

  const handleLogin = (event) => {
    event.preventDefault();
    const username = event.target.username.value;
    if (!username.trim()) return;

    const newUser = {
      id: customNanoid(),
      name: username,
      color: colors[Math.floor(Math.random() * colors.length)],
    };
    login(newUser);
  };

  return (
    <div className="centered">
      User:{" "}
      <form onSubmit={handleLogin}>
        <input name="username" required />
        <button type="submit">Go</button>
      </form>
    </div>
  );
}
