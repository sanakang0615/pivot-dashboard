import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const { user, isLoaded } = useUser();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    if (isLoaded && user) {
      setCurrentUser(user);
    } else if (isLoaded && !user) {
      setCurrentUser(null);
    }
  }, [isLoaded, user]);

  return (
    <UserContext.Provider value={{ user: currentUser, isLoaded }}>
      {children}
    </UserContext.Provider>
  );
};

export const useCurrentUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within a UserProvider');
  }
  return context;
};
