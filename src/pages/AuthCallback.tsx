import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Spinner, Alert } from "react-bootstrap";
import { User } from "@supabase/supabase-js";
import {
  supabase,
  getCurrentUser,
  getUserProfile,
  createUserProfile,
} from "../services/supabaseService";

const AuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // OAuth callback: implicit flow uses hash (#access_token=...)
        // Give client time to parse URL and establish session
        await new Promise((r) => setTimeout(r, 300));

        let user: User | null | undefined = (await supabase.auth.getSession()).data.session?.user;
        if (!user) {
          user = await getCurrentUser();
        }

        if (user) {
          // Check if profile exists
          const existingProfile = await getUserProfile(user.id);

          if (!existingProfile) {
            // Create profile for new user
            const userEmail = user.email || "user@example.com";
            const fullName =
              user.user_metadata?.full_name ||
              user.email?.split("@")[0] ||
              "User";
            await createUserProfile(user.id, userEmail, fullName);
          }

          // Clear URL params (tokens) and redirect to home
          window.history.replaceState({}, document.title, window.location.pathname);
          navigate("/", { replace: true });
        } else {
          setError("Failed to get user information");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        setError((err as Error).message || "Authentication failed");
        // Redirect to login after 3 seconds
        setTimeout(() => navigate("/login"), 3000);
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <Container className="py-5" style={{ minHeight: "100vh" }}>
      <div className="text-center">
        {error ? (
          <Alert variant="danger">{error}</Alert>
        ) : (
          <>
            <Spinner animation="border" variant="success" />
            <p className="mt-3">Processing authentication...</p>
          </>
        )}
      </div>
    </Container>
  );
};

export default AuthCallback;
