import TicTacToe from "./Components/TicTacToe";
import PeerJS from "./Components/PeerJS";
import Messages from "./Components/Messages";
import React, { useState } from "react";
import Peer from "peerjs";
import usePersistedState from "./Components/usePersistedState";

export const PeerContext = React.createContext();

function getRandomId() {
  let min = Math.ceil(10000000);
  let max = Math.floor(99999999);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function App() {
  const [id, setId] = usePersistedState("myId");
  const [me, setMe] = useState(null);
  const [targetPeerId, setTargetPeerId] = usePersistedState("targetPeerId");
  const [myConn, setConn] = useState(null);
  const [dataListeners, setDataListeners] = useState([]);
  if (id === undefined) return null;
  console.log("id: ", id);

  const cleanUp = () => {
    if (me) {
      me.disconnect();
      me.destroy();
    }
    setMe(null);
  };

  const connect = (id) => {
    const conn = myConn ? myConn : me.connect(id);
    conn.on("open", () => {
      console.log("connected to: ", id);
      setTargetPeerId(id);
    });
    setConn(conn);
    dataListeners.map((l) => conn.on("data", l));
  };

  const disconnect = () => {
    myConn.close();
    setTargetPeerId(undefined);
    setConn(null);
  };

  const sendData = (message) => {
    myConn.send(message);
  };

  const peer = me ? me : id !== undefined ? new Peer(id) : new Peer();

  peer.on("open", () => {
    console.log(`Peer ${peer.id} waiting for connection...`);
    setId(peer.id);
    setMe(peer);
    if (targetPeerId !== undefined) {
      console.log("targetPeerId: ", targetPeerId);
      const conn = peer.connect(targetPeerId);
      setConn(conn);
      dataListeners.map((l) => conn.on("data", l));
    }
  });

  peer.on("connection", (conn) => {
    console.log("connected to: ", conn);
    setTargetPeerId(conn.peer);
    setConn(conn);
    dataListeners.map((l) => conn.on("data", l));
  });

  peer.on("disconnected", () => {
    console.log("Peer disconnected");
    cleanUp();
  });

  peer.on("close", () => {
    console.log("Peer closed remotely");
    cleanUp();
  });

  peer.on("error", (error) => {
    console.log("peer error", error);
    cleanUp();
  });
  if (!me) return null;
  return (
    <PeerContext.Provider
      value={{
        me,
        setMe,
        myConn,
        setConn,
        disconnect,
        connect,
        sendData,
        dataListeners,
        setDataListeners,
      }}
    >
      <div className="App">
        <header className="App-header">
          <PeerJS />
          <Messages />
          <TicTacToe />
        </header>
      </div>
    </PeerContext.Provider>
  );
}

export default App;
