import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRoutesFromElements,
  createBrowserRouter,
  Navigate,
  RouterProvider,
  Route,
  useParams,
} from "react-router-dom";
import { DocumentProvider } from "./vendor/y-react";
import { Toaster } from "react-hot-toast";
import Root from "./routes/root";
import ErrorPage from "./error-page";
import "./index.css";
import Login from "./routes/login";
import { RequireAuth } from "./routes/RequireAuth";
import { peerOpts } from "./constants";

// a TURN relay login, for players whose networks block a direct connection.
// y-webrtc reads peerOpts as it connects to someone, after the login page.
fetch("/api/turn")
  .then((r) => r.json())
  .then(
    ({ iceServers }) => iceServers && (peerOpts.config.iceServers = iceServers),
  )
  .catch(() => {}); // the dev server has no /api: STUN only

// errors on the deployed site go to Sentry (manivela/p2pgames), and how fast
// pages load and answer taps: its loader (Performance on in the project's
// Client Keys settings) fetches the SDK with tracing at once
if (import.meta.env.PROD && location.hostname !== "localhost") {
  document.head.append(
    Object.assign(document.createElement("script"), {
      src: "https://js.sentry-cdn.com/5265340ee468b6a55143d3db1ac2cf4a.min.js",
      crossOrigin: "anonymous",
    }),
  );
}

// a link from before the room's game was the room's (/K7QP/okey): the room
function ToRoom() {
  const { roomId } = useParams();
  return <Navigate to={`/${roomId}`} replace />;
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<ErrorPage />}>
      <Route path="/" element={<Login />} />
      {/* <Route path="/" element={<Login />} /> */}
      <Route path="/login" element={<Login />} />
      {/* the room, at the game it's playing (root.jsx) */}
      <Route
        path="/:roomId"
        element={
          <RequireAuth>
            <Root />
          </RequireAuth>
        }
      />
      <Route path="/:roomId/*" element={<ToRoom />} />
    </Route>,
  ),
);
ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
  <DocumentProvider>
    <Toaster />
    <RouterProvider router={router} />
  </DocumentProvider>,
  // </React.StrictMode>
);
