import React, { useContext } from "react";
import usePersistedState from "../usePersistedState";
import { PeerContext } from "../../App";

export default function Messages() {
  const [messages, setMessages] = React.useState([]);
  const { me, sendData, setDataListeners } = useContext(PeerContext);
  React.useEffect(() => {
    const handleData = (data) => {
      if (data.type === "message") {
        setMessages((prevMessages) => [...prevMessages, data.data]);
      }
    };
    setDataListeners((prevDataListeners) => [...prevDataListeners, handleData]);
  }, []);
  if (!me) return null;
  return (
    <>
      <div
        style={{
          width: "300px",
          height: "200px",
          border: "1px solid #ccc",
          padding: "5px",
        }}
      >
        {messages.map((m, i) => (
          <div key={i}>
            <b>{m.id}</b>: {m.message}
          </div>
        ))}
      </div>
      <p>You can send messages here:</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const message = e.target.message.value;
          const data = { id: me.id, message };
          sendData({ type: "message", data });
          setMessages((prevMessages) => [...prevMessages, data]);
        }}
      >
        <input name="message"></input>
        <button type="submit">send</button>
      </form>
    </>
  );
}
