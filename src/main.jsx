import React from "react";
import ReactDOM from "react-dom/client";
import {
  createRoutesFromElements,
  createBrowserRouter,
  RouterProvider,
  Route,
} from "react-router-dom";
import { DocumentProvider } from "@joebobmiles/y-react";
import Root from "./routes/root";
import ErrorPage from "./error-page";
import "./index.css";
import Login from "./routes/login";
import { RequireAuth } from "./routes/RequireAuth";
import TicTacToe from "./components/TicTacToe";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route errorElement={<ErrorPage />}>
      <Route path="/" element={<Login />} />
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
          <Route index element={<TicTacToe />} />
        </Route>
      </Route>
    </Route>
  )
);
ReactDOM.createRoot(document.getElementById("root")).render(
  // <React.StrictMode>
  <DocumentProvider>
    <RouterProvider router={router} />
  </DocumentProvider>
  // </React.StrictMode>
);
