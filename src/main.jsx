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
import TicTacToe from "./Components/TicTacToe";
import Minecraft from "./Components/Minecraft/App";
import Chat from "./Components/Chat";

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
          <Route path="tictactoe" element={<TicTacToe />} />
          <Route path="minecraft" element={<Minecraft />} />
          <Route path="chat" element={<Chat />} />
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
