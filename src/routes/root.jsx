import { NavLink, Outlet } from "react-router-dom";
import Awareness from "../Components/Awareness";

export default function Root() {
  return (
    <>
      <div id="sidebar">
        <nav>
          <ul>
            <li>
              <NavLink
                to=""
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                TicTacToe
              </NavLink>
            </li>
            <li>
              <NavLink
                to="chat"
                className={({ isActive, isPending }) =>
                  isActive ? "active" : isPending ? "pending" : ""
                }
              >
                Chat
              </NavLink>
            </li>
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
          </ul>
        </nav>
        <div style={{ flexGrow: 1 }} />
        <Awareness />
      </div>
      <div id="detail">
        <Outlet />
      </div>
    </>
  );
}
