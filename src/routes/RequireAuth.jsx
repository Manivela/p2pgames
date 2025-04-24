import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../hooks/useStore";

export function RequireAuth({ children }) {
  const currentUser = useAuthStore((state) => state.currentUser);
  const location = useLocation();

  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
