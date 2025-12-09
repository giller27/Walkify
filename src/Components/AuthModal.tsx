import React, { useState } from "react";
import {
  Modal,
  Form,
  Button,
  Alert,
  Tabs,
  Tab,
  Spinner,
} from "react-bootstrap";
import { signUp, signIn, signInWithGoogle } from "../services/supabaseService";
import "./AuthModal.css";

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const AuthModal: React.FC<AuthModalProps> = ({ show, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirmPassword, setSignupConfirmPassword] = useState("");
  const [signupFullName, setSignupFullName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!loginEmail || !loginPassword) {
        throw new Error("Please fill in all fields");
      }

      await signIn(loginEmail, loginPassword);
      setSuccess("Successfully logged in!");
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!signupEmail || !signupPassword || !signupConfirmPassword) {
        throw new Error("Please fill in all fields");
      }

      if (signupPassword !== signupConfirmPassword) {
        throw new Error("Passwords do not match");
      }

      if (signupPassword.length < 6) {
        throw new Error("Password must be at least 6 characters");
      }

      await signUp(signupEmail, signupPassword, signupFullName);
      setSuccess(
        "Account created successfully! Please check your email to verify your account."
      );
      setTimeout(() => {
        setSignupEmail("");
        setSignupPassword("");
        setSignupConfirmPassword("");
        setSignupFullName("");
        setActiveTab("login");
      }, 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      await signInWithGoogle();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError(null);
    setSuccess(null);
    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupConfirmPassword("");
    setSignupFullName("");
    onClose();
  };

  return (
    <Modal show={show} onHide={handleClose} centered className="auth-modal">
      <Modal.Header closeButton className="auth-header">
        <Modal.Title>Welcome to Walkify</Modal.Title>
      </Modal.Header>
      <Modal.Body className="auth-body">
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Tabs
          activeKey={activeTab}
          onSelect={(k) => setActiveTab(k as "login" | "signup")}
          className="mb-4"
        >
          {/* Login Tab */}
          <Tab eventKey="login" title="Login">
            <Form onSubmit={handleLogin} className="auth-form">
              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter your email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Button
                variant="primary"
                type="submit"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      className="me-2"
                    />
                    Logging in...
                  </>
                ) : (
                  "Login"
                )}
              </Button>
            </Form>

            <div className="divider">or</div>

            <Button
              variant="outline-secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <img
                src="https://www.gstatic.com/firebaseapp/v8.2.5/images/firebaseui-icon-google.svg"
                alt="Google"
                width={20}
              />
              {loading ? "Signing in..." : "Sign in with Google"}
            </Button>
          </Tab>

          {/* Signup Tab */}
          <Tab eventKey="signup" title="Create Account">
            <Form onSubmit={handleSignup} className="auth-form">
              <Form.Group className="mb-3">
                <Form.Label>Full Name (Optional)</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="Enter your full name"
                  value={signupFullName}
                  onChange={(e) => setSignupFullName(e.target.value)}
                  disabled={loading}
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Email Address</Form.Label>
                <Form.Control
                  type="email"
                  placeholder="Enter your email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="At least 6 characters"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Confirm Password</Form.Label>
                <Form.Control
                  type="password"
                  placeholder="Re-enter your password"
                  value={signupConfirmPassword}
                  onChange={(e) => setSignupConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </Form.Group>

              <Button
                variant="success"
                type="submit"
                className="w-100 mb-3"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      className="me-2"
                    />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </Form>

            <div className="divider">or</div>

            <Button
              variant="outline-secondary"
              className="w-100 d-flex align-items-center justify-content-center gap-2"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <img
                src="https://www.gstatic.com/firebaseapp/v8.2.5/images/firebaseui-icon-google.svg"
                alt="Google"
                width={20}
              />
              {loading ? "Signing up..." : "Sign up with Google"}
            </Button>
          </Tab>
        </Tabs>
      </Modal.Body>
    </Modal>
  );
};

export default AuthModal;
