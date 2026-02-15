import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Container, Spinner, Alert } from "react-bootstrap";
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
        // OAuth callback: Supabase may pass auth via hash (#access_token=...) or PKCE (?code=...)
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash?.replace("#", "") || "");
        const code = params.get("code") || hashParams.get("code");

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          // Hash flow: client parses #access_token=... automatically, but may need a moment
          await new Promise((r) => setTimeout(r, 300));
        }

        let user = (await supabase.auth.getSession()).data.session?.user;
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
