// Mock d'@auth0/auth0-react pour le développement local sans Auth0.
// Activez-le en lançant Next avec :
//   NEXT_PUBLIC_MOCK_AUTH=true npm run dev

import React from "react";

export const Auth0Provider = ({ children }) => <>{children}</>;

const mockUser = {
  name: "Dev Admin",
  // Changez 'admin' → 'user' pour tester le flux client
  "https://app.com/role": "admin",
  "https://app.com/client": "Lescot",
  clients: ["Lescot"],
};

export function useAuth0() {
  // Références stables pour éviter les rerenders infinis
  const loginWithRedirect = React.useCallback(() => {}, []);
  const logout = React.useCallback(() => {}, []);

  return React.useMemo(
    () => ({
      isAuthenticated: true,
      isLoading: false,
      user: mockUser,
      loginWithRedirect,
      logout,
    }),
    []
  );
} 