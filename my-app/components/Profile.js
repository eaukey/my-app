import React from "react";
import { useAuth0 } from "@auth0/auth0-react";

const Profile = () => {
  const { user, isAuthenticated, isLoading } = useAuth0();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    isAuthenticated && (
      <div>
        <h3>Bienvenue {user.name}</h3>
        <p>Email : {user.email}</p>
      </div>
    )
  );
};

export default Profile;
