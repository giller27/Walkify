import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import * as supabaseModules from "../services/supabaseService";

const Login: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
  });

  // Якщо користувач вже авторизований, перенаправляємо на домашню сторінку
  React.useEffect(() => {
    if (user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Функція для валідації повного імені - дозволяє будь-які символи
  const validateFullName = (name: string): string => {
    return name.trim();
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await supabaseModules.signIn(formData.email, formData.password);
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Помилка при вході");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Перевірити повне ім'я
      const cleanedFullName = validateFullName(formData.full_name);
      if (!cleanedFullName) {
        throw new Error("Повне ім'я не повинне бути порожнім");
      }

      await supabaseModules.signUp(
        formData.email,
        formData.password,
        cleanedFullName
      );
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Помилка при реєстрації");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);

    try {
      // signInWithGoogle redirects to callback, so this is for OAuth flow
      // The actual user creation happens in the callback
      await supabaseModules.signInWithGoogle();
      // Note: redirect happens, so this line might not execute
      // Auth state will be updated via AuthContext listener
    } catch (err: any) {
      // Обробка конкретних помилок Google OAuth
      if (err?.error_code === "validation_failed") {
        setError(
          "Google OAuth не налаштований. Будь ласка використайте Email/Password"
        );
      } else if (
        err?.code === 400 ||
        err?.error_code === "unsupported_provider"
      ) {
        setError(
          "Google OAuth не увімкнений. Будь ласка спробуйте Email/Password"
        );
      } else {
        setError((err as Error).message || "Помилка при вході через Google");
      }
      setLoading(false);
    }
  };

  return (
    <Container className="py-5" style={{ minHeight: "100vh" }}>
      <Row className="justify-content-center">
        <Col lg={5} md={6} xs={12}>
          <Card className="shadow-sm">
            <Card.Body className="p-5">
              <h1 className="text-center mb-4">
                <i className="bi bi-shoe me-2"></i>Walkify
              </h1>

              {error && <Alert variant="danger">{error}</Alert>}

              <Form
                onSubmit={isSignUp ? handleSignUp : handleSignIn}
                className="mb-4"
              >
                {isSignUp && (
                  <Form.Group className="mb-3">
                    <Form.Label>Повне ім'я</Form.Label>
                    <Form.Control
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Ваше повне ім'я"
                      disabled={loading}
                    />
                  </Form.Group>
                )}

                <Form.Group className="mb-3">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="you@example.com"
                    disabled={loading}
                  />
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>Пароль</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    disabled={loading}
                  />
                </Form.Group>

                <Button
                  variant="success"
                  type="submit"
                  className="w-100 mb-3"
                  disabled={loading}
                >
                  {loading
                    ? "Завантаження..."
                    : isSignUp
                    ? "Зареєструватися"
                    : "Увійти"}
                </Button>
              </Form>

              <div className="d-grid gap-2 mb-4">
                <Button
                  variant="outline-danger"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="d-flex align-items-center justify-content-center"
                >
                  {/* Google логотип RGB */}
                  <i className="bi bi-google pe-2"></i>
                  Увійти через Google
                </Button>
              </div>

              <div className="text-center">
                <p className="mb-0">
                  {isSignUp ? "Вже маєте аккаунт?" : "Немає аккаунту?"}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="btn btn-link p-0 ms-2"
                    disabled={loading}
                  >
                    {isSignUp ? "Увійти" : "Зареєструватися"}
                  </button>
                </p>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Login;
