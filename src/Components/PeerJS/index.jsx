import React, { useContext } from "react";
import { PeerContext } from "../../App";
import usePersistedState from "../usePersistedState";

export default function PeerJS() {
  const { me, myConn, setTargetPeerId, connect, disconnect } =
    useContext(PeerContext);
  if (!me) return null;
  return (
    <>
      <p>
        This is your id send it to a friend to connect with them:{" "}
        <input defaultValue={me.id} name="id" readOnly></input>
      </p>
      {myConn?.peer ? (
        <div>
          Connected to: {myConn?.peer}{" "}
          <button onClick={() => disconnect(null)}>disconnect</button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            connect(e.target.id.value);
          }}
        >
          <input name="id"></input>
          <button type="submit">connect</button>
        </form>
      )}
    </>
  );
}
