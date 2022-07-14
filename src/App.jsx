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
  const [id, setId, loading] = usePersistedState("myId");
  console.log("id: ", id);
  const [me, setMe] = useState(null);
  const [targetPeerId, setTargetPeerId] = usePersistedState("targetPeerId");
  const [myConn, setConn] = useState(null);
  const [dataListeners, setDataListeners] = useState([]);
  console.log("dataListeners: ", dataListeners);
  const [players, setPlayers] = useState([]);
  React.useEffect(() => {
    if (myConn) {
      dataListeners.map((l) => myConn.on("data", l));
    }
  }, [dataListeners, myConn]);
  if (loading) return null;

  const cleanUp = () => {
    if (me) {
      me.disconnect();
      me.destroy();
    }
    setMe(null);
  };

  const fullReset = () => {
    cleanUp();
    setTargetPeerId(null);
    setId(null);
  };

  const connect = (id) => {
    const conn = myConn ? myConn : me.connect(id);
    conn.on("open", () => {
      console.log("connected to: ", id);
      setTargetPeerId(id);
    });
    setConn(conn);
    setPlayers([{ id: me.id }, { id: id }]);
    dataListeners.map((l) => conn.on("data", l));
  };

  const disconnect = () => {
    myConn.close();
    setTargetPeerId(null);
    setConn(null);
  };

  const sendData = (data) => {
    myConn.send(data);
  };

  const peer = me ? me : id !== null ? new Peer(id) : new Peer();

  peer.on("open", () => {
    console.log(`Peer ${peer.id} waiting for connection...`);
    setId(peer.id);
    setMe(peer);
    if (targetPeerId !== null) {
      console.log("targetPeerId: ", targetPeerId);
      const conn = peer.connect(targetPeerId);
      setConn(conn);
      setPlayers([{ id: peer.id }, { id: targetPeerId }]);
    }
  });

  peer.on("connection", (conn) => {
    console.log("connected to: ", conn);
    setTargetPeerId(conn.peer);
    setConn(conn);
    setPlayers([{ id: peer.id }, { id: targetPeerId }]);
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
    fullReset();
  });
  if (!me) return null;
  console.log("players: ", players);
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
          <TicTacToe
            id={id}
            players={players}
            setPlayers={setPlayers}
            sendData={sendData}
            setDataListeners={setDataListeners}
          />
        </header>
      </div>
    </PeerContext.Provider>
  );
}

export default App;
