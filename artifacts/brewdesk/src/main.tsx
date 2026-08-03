import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { startVersionCheck } from "./lib/version-check";

startVersionCheck();

createRoot(document.getElementById("root")!).render(<App />);
