import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    const msg = await invoke<string>("greet", { name });
    setGreetMsg(msg);
  }

  return (
    <main>
      <h1>O.K.Plug</h1>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          placeholder="Enter a name..."
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
