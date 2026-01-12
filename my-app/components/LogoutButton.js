import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const LogoutButton = () => {
  const { logout } = useAuth0();

  return (
    <button
      onClick={() => logout({ returnTo: "https://my-app-zeta-blue.vercel.app/" })}
      style={{
        padding: "8px 16px",
        backgroundColor: "var(--primary)",
        color: "#04131a",
        border: "1px solid var(--primary-strong)",
        borderRadius: "8px",
        cursor: "pointer",
      }}
    >
      Se déconnecter
    </button>
  );
};

export default LogoutButton;
