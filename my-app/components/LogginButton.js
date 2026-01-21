import React from "react";
import { useRouter } from "next/navigation";

const LoginButton = () => {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/")}
      style={{
        padding: "8px 16px",
        backgroundColor: "var(--primary)",
        color: "#04131a",
        border: "1px solid var(--primary-strong)",
        borderRadius: "8px",
        cursor: "pointer",
      }}
    >
      Se connecter
    </button>
  );
};

export default LoginButton;
