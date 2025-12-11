import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Button,
  Form,
  Spinner,
  Alert,
  Modal,
} from "react-bootstrap";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  updateUserProfile,
  uploadAvatar,
  getUserWalkStatistics,
  WalkStatistic,
} from "../services/supabaseService";
import user from "../assets/images/user.png";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user: currentUser, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(
    searchParams.get("edit") === "true"
  );
  const [showStats, setShowStats] = useState(false);
  const [statistics, setStatistics] = useState<WalkStatistic[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    bio: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        email: profile.email || "",
        bio: profile.bio || "",
      });
      setAvatarPreview(profile.avatar_url || null);
      // Set document title to user's full name
      document.title = `${profile.full_name || "Профіль"} | Walkify`;
    }
  }, [profile]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAvatarPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!currentUser) throw new Error("User not authenticated");

      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(currentUser.id, avatarFile);
      }

      await updateUserProfile(currentUser.id, {
        full_name: formData.full_name,
        email: formData.email,
        bio: formData.bio,
        avatar_url: avatarUrl,
      });

      setSuccess("Profile updated successfully!");
      setIsEditing(false);
      setAvatarFile(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadStatistics = async () => {
    if (!currentUser) return;
    setStatsLoading(true);
    try {
      const stats = await getUserWalkStatistics(currentUser.id);
      setStatistics(stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStatsLoading(false);
    }
  };

  // Розрахунок загальної статистики
  const calculateStats = () => {
    const totalDistance = statistics.reduce(
      (sum, stat) => sum + (stat.distance_km || 0),
      0
    );
    const totalTime = statistics.reduce(
      (sum, stat) => sum + (stat.duration_minutes || 0),
      0
    );
    const avgPace = totalDistance > 0 ? totalTime / 60 / totalDistance : 0;
    return {
      walks: statistics.length,
      distance: totalDistance,
      time: totalTime,
      pace: avgPace,
    };
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!currentUser) {
    return (
      <Container className="py-5 text-center">
        <Row className="justify-content-center">
          <Col lg={6} md={8}>
            <Alert variant="info">
              <Alert.Heading>
                <i className="bi bi-info-circle me-2"></i>
                Авторизація потрібна
              </Alert.Heading>
              <p>Для перегляду профілю потрібно увійти у свій аккаунт.</p>
              <Button
                variant="success"
                onClick={() => navigate("/login")}
                className="mt-3"
              >
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Перейти на сторінку входу
              </Button>
            </Alert>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="py-5">
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Row className="mb-5">
        <Col lg={4} md={6} className="mx-auto">
          <Card className="profile-card text-center">
            <Card.Body>
              <div className="avatar-container mb-4">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Avatar"
                    className="rounded-circle"
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={user}
                    alt="Default Avatar"
                    className="rounded-circle"
                    style={{
                      width: "120px",
                      height: "120px",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>

              {isEditing && (
                <div className="mb-3">
                  <Form.Group>
                    <Form.Label>Change Avatar</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                    />
                  </Form.Group>
                </div>
              )}
              <h4
                className="mb-1"
                style={{ fontSize: "24px", fontWeight: "bold", color: "black" }}
              >
                {profile?.full_name || currentUser?.email || "Користувач"}
              </h4>
              <p
                style={{
                  fontSize: "14px",
                  color: "#6c757d",
                  marginBottom: "24px",
                }}
              >
                {currentUser?.email}
              </p>

              {!isEditing ? (
                <>
                  {profile?.bio && (
                    <p className="text-muted mb-3">{profile.bio}</p>
                  )}

                  <Row className="mb-4 text-center">
                    <Col xs={6} className="mb-3">
                      <div className="stat-box">
                        <h5 className="mb-1">{calculateStats().walks}</h5>
                        <p className="text-muted">Прогулянок</p>
                      </div>
                    </Col>
                    <Col xs={6} className="mb-3">
                      <div className="stat-box">
                        <h5 className="mb-1">
                          {calculateStats().distance.toFixed(1)}км
                        </h5>
                        <p className="text-muted">Відстань</p>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="stat-box">
                        <h5 className="mb-1">
                          {Math.round(calculateStats().time)}хв
                        </h5>
                        <p className="text-muted">Загальний час</p>
                      </div>
                    </Col>
                    <Col xs={6}>
                      <div className="stat-box">
                        <h5 className="mb-1">
                          {calculateStats().pace.toFixed(2)}км/год
                        </h5>
                        <p className="text-muted">Середня швидкість</p>
                      </div>
                    </Col>
                  </Row>

                  <Button
                    variant="primary"
                    className="w-100 mb-2"
                    onClick={() => setIsEditing(true)}
                  >
                    <i className="bi bi-pencil me-2"></i>
                    Редагувати профіль
                  </Button>

                  <Button
                    variant="outline-info"
                    className="w-100 mb-2"
                    onClick={() => {
                      setShowStats(true);
                      handleLoadStatistics();
                    }}
                  >
                    <i className="bi bi-graph-up me-2"></i>
                    Переглянути статистику
                  </Button>

                  <Button
                    variant="outline-danger"
                    className="w-100"
                    onClick={handleSignOut}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Вихід
                  </Button>
                </>
              ) : (
                <Form onSubmit={handleSaveProfile} className="text-start">
                  <Form.Group className="mb-3">
                    <Form.Label>Змінити аватар</Form.Label>
                    <Form.Control
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      disabled={loading}
                    />
                    {avatarPreview && (
                      <div className="mt-2 text-center">
                        <img
                          src={avatarPreview}
                          alt="Avatar Preview"
                          className="rounded-circle"
                          style={{
                            width: "80px",
                            height: "80px",
                            objectFit: "cover",
                          }}
                        />
                      </div>
                    )}
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Повне ім'я</Form.Label>
                    <Form.Control
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      disabled={loading}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="text"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Виберіть унікальну почту"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Про вас</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Розкажіть нам про себе"
                    />
                  </Form.Group>

                  <Button
                    variant="success"
                    type="submit"
                    className="w-100 mb-2"
                    disabled={loading}
                  >
                    <i className="bi bi-check-circle me-2"></i>
                    {loading ? "Збереження..." : "Зберегти зміни"}
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-100"
                    onClick={() => {
                      setIsEditing(false);
                      setAvatarFile(null);
                      setAvatarPreview(profile?.avatar_url || null);
                    }}
                    disabled={loading}
                  >
                    <i className="bi bi-x-circle me-2"></i>
                    Скасувати
                  </Button>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showStats} onHide={() => setShowStats(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Статистика ваших прогулянок</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {statsLoading ? (
            <div className="text-center">
              <Spinner animation="border" />
            </div>
          ) : statistics.length === 0 ? (
            <p className="text-muted text-center">
              Записів про прогулянки ще немає. Починайте гуляти, щоб
              відстежувати прогрес!
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Дата</th>
                    <th>Відстань (км)</th>
                    <th>Час (хв)</th>
                    <th>Темп (км/год)</th>
                    <th>Настрій</th>
                  </tr>
                </thead>
                <tbody>
                  {statistics.map((stat) => (
                    <tr key={stat.id}>
                      <td>{new Date(stat.date).toLocaleDateString()}</td>
                      <td>{stat.distance_km.toFixed(2)}</td>
                      <td>{stat.duration_minutes}</td>
                      <td>{stat.pace.toFixed(2)}</td>
                      <td>{stat.mood || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </Container>
  );
};

export default Profile;
