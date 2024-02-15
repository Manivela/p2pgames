import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";
import { DocumentProvider } from "@joebobmiles/y-react";
import { Toaster } from "react-hot-toast";
import Root from "./routes/root";
import ErrorPage from "./error-page";
import "./index.css";
import Login from "./routes/login";
import { RequireAuth } from "./routes/RequireAuth";
import Okey from "./Components/Okey";

const TicTacToe = React.lazy(() => import("./Components/TicTacToe"));
const Minecraft = React.lazy(() => import("./Components/Minecraft/App"));
const Chat = React.lazy(() => import("./Components/Chat"));
const Backgammon = React.lazy(() =>
  import("./Components/Backgammon/containers/App")
);
const Go = React.lazy(() => import("./Components/Go"));

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<ErrorPage />}>
      <Route
        path="/"
        element={
          <React.Suspense fallback={<>...</>}>
            <Go />
          </React.Suspense>
        }
      />
      {/* <Route path="/" element={<Login />} /> */}
      <Route path="/login" element={<Login />} />
      <Route
        path="/:roomId/"
        element={
          <RequireAuth>
            <Root />
          </RequireAuth>
        }
        errorElement={<ErrorPage />}
      >
        <Route errorElement={<ErrorPage />}>
          <Route
            path="tictactoe"
            element={
              <React.Suspense fallback={<>...</>}>
                <TicTacToe />
              </React.Suspense>
            }
          />
          <Route
            path="minecraft"
            element={
              <React.Suspense fallback={<>...</>}>
                <Minecraft />
              </React.Suspense>
            }
          />
          {/* <Route
            path="chat"
            element={
              <React.Suspense fallback={<>...</>}>
                <Chat />
              </React.Suspense>
            }
          /> */}
          <Route
            path="backgammon"
            element={
              <React.Suspense fallback={<>...</>}>
                <Backgammon />
              </React.Suspense>
            }
          />
          <Route
            path="okey"
            element={
              <React.Suspense fallback={<>...</>}>
                <Okey />
              </React.Suspense>
            }
          />
        </Route>
      </Route>
    </Route>
  )
);
ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
  <DocumentProvider>
    <Toaster />
    <RouterProvider router={router} />
  </DocumentProvider>
  // </React.StrictMode>
);
