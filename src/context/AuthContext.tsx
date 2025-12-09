import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import {
  supabase,
  getCurrentUser,
  onAuthStateChange,
  UserProfile,
  getUserProfile,
} from "../services/supabaseService";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Отримати поточного користувача при завантаженні
    const checkUser = async () => {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          try {
            const userProfile = await getUserProfile(currentUser.id);
            setProfile(userProfile);
          } catch (profileError) {
            console.error("Error fetching profile:", profileError);
            // Користувач авторизований, але профіль не завантажується - це окей
            setProfile(null);
          }
        }
      } catch (error) {
        console.error("Error checking user:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    // Спостерігати за змінами аутентифікації
    const { data: authListener } = onAuthStateChange(async (user) => {
      if (user) {
        setUser(user);
        try {
          const userProfile = await getUserProfile(user.id);
          setProfile(userProfile);
        } catch (error) {
          console.error("Error fetching profile:", error);
          setProfile(null);
        }
      } else {
        setUser(null);
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const value: AuthContextType = {
    user,
    profile,
    loading,
    signOut: handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
