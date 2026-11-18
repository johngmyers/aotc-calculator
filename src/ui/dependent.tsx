import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AotcDependentCalculator } from "./AotcDependentCalculator.js";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AotcDependentCalculator />
  </StrictMode>,
);