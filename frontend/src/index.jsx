import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider> {/*  WRAP APP WITH AuthProvider */}
      <App />
    </AuthProvider> {/*  CLOSE AuthProvider */}
  </React.StrictMode>
);
