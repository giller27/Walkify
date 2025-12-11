import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Spinner, Alert } from "react-bootstrap";
import {
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
        // Get the current user from the OAuth callback
        const user = await getCurrentUser();

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

          // Redirect to home
          navigate("/");
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
