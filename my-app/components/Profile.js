import React from "react";
import { useAuth } from "../lib/auth";
import Image from 'next/image';

const Profile = () => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Chargement...</div>;
  }

  return (
    isAuthenticated && (
      <div>
        <h3>Bienvenue {user?.name || user?.email}</h3>
        <p>Email : {user.email}</p>
      </div>
    )
  );
};

export default Profile;
