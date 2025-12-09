import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "bootstrap/dist/css/bootstrap.css";

import { AuthProvider } from "./context/AuthContext";

// Debug env
if (typeof window !== "undefined") {
  console.log("Environment variables check:");
  console.log(
    "VITE_SUPABASE_URL:",
    import.meta.env.VITE_SUPABASE_URL ? "✓ Set" : "✗ Missing"
  );
  console.log(
    "VITE_SUPABASE_ANON_KEY:",
    import.meta.env.VITE_SUPABASE_ANON_KEY ? "✓ Set" : "✗ Missing"
  );
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
