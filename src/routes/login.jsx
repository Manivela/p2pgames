import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../hooks/useStore";
import { customNanoid } from "../utils/customNanoid";

const colors = ["red", "green", "blue", "orange", "yellow"];

export default function Login() {
  const [currentUser, login] = useAuthStore((state) => [
    state.currentUser,
    state.login,
  ]);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname;

  useEffect(() => {
    if (currentUser) {
      navigate(from || `/${currentUser.id}/`, { replace: true });
    }
  }, [currentUser]);

  return (
    <div className="centered">
      User:{" "}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const newUser = {
            id: customNanoid(),
            name: event.target.username.value,
            color: colors[Math.floor(Math.random() * colors.length)],
          };
          login(newUser);
          navigate(from || `/${newUser.id}/`, { replace: true });
        }}
      >
        <input name="username" />
        <button type="submit">Go</button>
      </form>
    </div>
  );
}
