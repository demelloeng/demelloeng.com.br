import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "./GlobalApp.jsx";
import "./styles.css";
import { installContactClicks } from "../../assets/js/contact-clicks.mjs";

// Cliques em WhatsApp, telefone e e-mail (inclusive o botão flutuante) entram na mesma medição das páginas estáticas.
// O ouvinte é único por documento: nenhum clique conta duas vezes.
installContactClicks();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
