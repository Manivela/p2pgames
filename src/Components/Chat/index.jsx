import { useArray } from "@joebobmiles/y-react";
import React, { useRef } from "react";
import { useAuthStore } from "../../hooks/useStore";
import "./Chat.css";

function formatTimeFromISOString(isoString) {
  const date = new Date(isoString);
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  const seconds = date.getSeconds().toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export default function Chat() {
  const [currentUser] = useAuthStore((state) => [state.currentUser]);
  const { push, state: messages } = useArray("chat-state");
  const messageBoxRef = useRef();
  React.useEffect(() => {
    messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight; // scroll to the bottom
  }, [messages]);
  return (
    <>
      <div className="message-box" ref={messageBoxRef}>
        {messages.map((m, i) => (
          <div key={i}>
            <i>{formatTimeFromISOString(m.createdAt)}</i> <b>{m.user.name}</b>:{" "}
            {m.message}
          </div>
        ))}
      </div>
      <form
        className="message-input"
        onSubmit={(e) => {
          e.preventDefault();
          const message = e.target.message.value;
          const data = {
            user: currentUser,
            message,
            createdAt: new Date().toISOString(),
          };
          push([data]);
          e.target.reset();
        }}
      >
        <input name="message" style={{ width: "80%" }} />
        <button type="submit" style={{ width: "20%" }}>
          send
        </button>
      </form>
    </>
  );
}
