import { NavLink, Outlet } from "react-router-dom";
import { toast } from "react-hot-toast";
import Awareness from "../Components/Awareness";
import Credits from "../Components/Credits";

export default function Root() {
  return (
    <>
      <div id="sidebar">
        <nav>
          <ul>
            <li>
              <NavLink
                to="tictactoe"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                TicTacToe
              </NavLink>
            </li>
            {/* <li>
              <NavLink
                to="chat"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Chat
              </NavLink>
            </li> */}
            <li>
              <NavLink
                to="backgammon"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Backgammon
              </NavLink>
            </li>
            <li>
              <NavLink
                to="minecraft"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Minecraft
              </NavLink>
            </li>
            <li>
              <NavLink
                to="okey"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Okey
              </NavLink>
            </li>
            <li>
              <NavLink
                to="go"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Go
              </NavLink>
            </li>
          </ul>
        </nav>
        <div style={{ flexGrow: 1 }} />
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Copied!");
          }}
        >
          Share Link
        </button>
        <Credits />
        <Awareness />
      </div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
