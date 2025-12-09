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
      await supabaseModules.signUp(formData.email, formData.password);
      // Створити профіль користувача
      const user = await supabaseModules.getCurrentUser();
      if (user) {
        await supabaseModules.createUserProfile(user.id, formData.full_name);
      }
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
      await supabaseModules.signInWithGoogle();
      navigate("/");
    } catch (err) {
      setError((err as Error).message || "Помилка при вході через Google");
    } finally {
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
                    <Form.Label>Ім'я</Form.Label>
                    <Form.Control
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Введіть ваше ім'я"
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
                  <i className="bi bi-google me-2"></i>
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
