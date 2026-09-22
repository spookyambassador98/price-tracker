import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { GateShell } from "./components/GateShell";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <GateShell>
        <App />
      </GateShell>
    </BrowserRouter>
  </StrictMode>
);
