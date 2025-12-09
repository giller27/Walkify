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
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  updateUserProfile,
  uploadAvatar,
  getUserWalkStatistics,
  WalkStatistic,
} from "../services/supabaseService";

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [statistics, setStatistics] = useState<WalkStatistic[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);

  const [formData, setFormData] = useState({
    full_name: "",
    username: "",
    bio: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        username: profile.username || "",
        bio: profile.bio || "",
      });
      setAvatarPreview(profile.avatar_url || null);
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
      if (!user) throw new Error("User not authenticated");

      let avatarUrl = profile?.avatar_url;
      if (avatarFile) {
        avatarUrl = await uploadAvatar(user.id, avatarFile);
      }

      await updateUserProfile(user.id, {
        full_name: formData.full_name,
        username: formData.username,
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
    if (!user) return;
    setStatsLoading(true);
    try {
      const stats = await getUserWalkStatistics(user.id);
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

  if (!user) {
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
                  <div
                    className="rounded-circle bg-secondary d-flex align-items-center justify-content-center"
                    style={{
                      width: "120px",
                      height: "120px",
                      margin: "0 auto",
                    }}
                  >
                    <span style={{ fontSize: "48px", color: "white" }}>👤</span>
                  </div>
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

              <h4 className="mb-2">
                {profile?.full_name || user?.email || "Користувач"}
              </h4>
              <p className="text-muted mb-3">
                @{profile?.username || user?.email?.split("@")[0] || "user"}
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
                    <Form.Label>Full Name</Form.Label>
                    <Form.Control
                      type="text"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      disabled={loading}
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control
                      type="text"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Choose a unique username"
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>Bio</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      disabled={loading}
                      placeholder="Tell us about yourself"
                    />
                  </Form.Group>

                  <Button
                    variant="success"
                    type="submit"
                    className="w-100 mb-2"
                    disabled={loading}
                  >
                    {loading ? "Saving..." : "Save Changes"}
                  </Button>

                  <Button
                    variant="secondary"
                    className="w-100"
                    onClick={() => setIsEditing(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Modal show={showStats} onHide={() => setShowStats(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Your Walking Statistics</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {statsLoading ? (
            <div className="text-center">
              <Spinner animation="border" />
            </div>
          ) : statistics.length === 0 ? (
            <p className="text-muted text-center">
              No walking records yet. Start walking to track your progress!
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Distance (km)</th>
                    <th>Time (min)</th>
                    <th>Pace (km/h)</th>
                    <th>Mood</th>
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
