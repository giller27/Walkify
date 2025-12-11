import React, { useState, useEffect } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Spinner,
  Alert,
  Button,
} from "react-bootstrap";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  getUserProfile,
  getUserProfileByUsername,
  getUserWalkStatistics,
  WalkStatistic,
  UserProfile as UserProfileType,
  getUserRoutes,
  SavedRoute,
} from "../services/supabaseService";
import user from "../assets/images/user.png";

function ViewUserProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user: currentUser, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [statistics, setStatistics] = useState<WalkStatistic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setError("Користувач не знайдений");
      setLoading(false);
      return;
    }

    const loadUserData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Load profile by user ID
        const userProfile = await getUserProfile(id);
        if (!userProfile) {
          setError("Користувач не знайдений");
          return;
        }
        setProfile(userProfile);

        // Load public routes
        const userRoutes = await getUserRoutes(userProfile.id);
        const publicRoutes = userRoutes.filter((route) => route.is_public);
        setRoutes(publicRoutes);

        // Load statistics
        const userStats = await getUserWalkStatistics(userProfile.id);
        setStatistics(userStats);
      } catch (err: any) {
        console.error("Error loading user data:", err);
        setError(err.message || "Не вдалось завантажити профіль");
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, [id]);

  if (loading) {
    return (
      <Container className="mt-5 pt-5 text-center">
        <Spinner animation="border" variant="success" />
        <p className="mt-3">Завантаження профілю...</p>
      </Container>
    );
  }

  if (error) {
    return (
      <Container className="mt-5 pt-5">
        <Alert variant="danger">{error}</Alert>
        <div className="text-center">
          <Button variant="success" onClick={() => navigate("/home")}>
            Назад на головну
          </Button>
        </div>
      </Container>
    );
  }

  const totalWalks = statistics.length;
  const totalDistance = statistics
    .reduce((sum, stat) => sum + stat.distance_km, 0)
    .toFixed(1);
  const totalTime = statistics.reduce(
    (sum, stat) => sum + stat.duration_minutes,
    0
  );
  const avgPace =
    totalWalks > 0
      ? (
          statistics.reduce((sum, stat) => sum + stat.pace, 0) / totalWalks
        ).toFixed(2)
      : 0;

  return (
    <Container className="mt-5 pt-5 mb-5">
      <Row className="mb-5">
        <Col lg={4} md={6} className="mx-auto">
          <Card className="profile-card text-center shadow-sm">
            <Card.Body className="p-4">
              {/* Фото користувача */}
              <div className="mb-4">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt="Avatar"
                    className="rounded-circle"
                    style={{
                      width: "140px",
                      height: "140px",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <img
                    src={user}
                    alt="Default Avatar"
                    className="rounded-circle"
                    style={{
                      width: "140px",
                      height: "140px",
                      objectFit: "cover",
                    }}
                  />
                )}
              </div>

              {/* Full Name */}
              {profile?.full_name && (
                <h3
                  style={{
                    fontSize: "24px",
                    fontWeight: "bold",
                    color: "#000",
                    marginBottom: "8px",
                  }}
                >
                  {profile.full_name}
                </h3>
              )}

              {/* Nickname */}
              {profile?.email && (
                <p
                  style={{
                    fontSize: "16px",
                    color: "#666",
                    marginBottom: "12px",
                  }}
                >
                  @{profile.email}
                </p>
              )}

              {/* Bio */}
              {profile?.bio && (
                <p
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    fontStyle: "italic",
                    marginBottom: "20px",
                    paddingTop: "16px",
                    borderTop: "1px solid #eee",
                  }}
                >
                  {profile.bio}
                </p>
              )}

              {/* Statistics */}
              <div
                className="mt-4 pt-4"
                style={{ borderTop: "1px solid #eee" }}
              >
                <Row className="text-center mb-3">
                  <Col xs={6} className="mb-3">
                    <div>
                      <h5 className="mb-1" style={{ color: "#28a745" }}>
                        {totalWalks}
                      </h5>
                      <p className="text-muted mb-0">Прогулянок</p>
                    </div>
                  </Col>
                  <Col xs={6} className="mb-3">
                    <div>
                      <h5 className="mb-1" style={{ color: "#28a745" }}>
                        {totalDistance} км
                      </h5>
                      <p className="text-muted mb-0">Відстані</p>
                    </div>
                  </Col>
                </Row>

                <Row className="text-center">
                  <Col xs={6} className="mb-3">
                    <div>
                      <h5 className="mb-1" style={{ color: "#28a745" }}>
                        {(totalTime / 60).toFixed(1)} год
                      </h5>
                      <p className="text-muted mb-0">Часу</p>
                    </div>
                  </Col>
                  <Col xs={6} className="mb-3">
                    <div>
                      <h5 className="mb-1" style={{ color: "#28a745" }}>
                        {avgPace} км/год
                      </h5>
                      <p className="text-muted mb-0">Швидкість</p>
                    </div>
                  </Col>
                </Row>
              </div>

              {currentUser?.id === id ? (
                <>
                  <Button
                    variant="primary"
                    className="w-100 mt-4 mb-2"
                    onClick={() => navigate("/profile?edit=true")}
                  >
                    <i className="bi bi-pencil me-2"></i>
                    Редагувати профіль
                  </Button>
                  <Button
                    variant="outline-danger"
                    className="w-100"
                    onClick={async () => {
                      await signOut();
                      navigate("/login");
                    }}
                  >
                    <i className="bi bi-box-arrow-right me-2"></i>
                    Вихід
                  </Button>
                </>
              ) : (
                <Button
                  variant="success"
                  className="w-100 mt-4"
                  onClick={() => navigate("/home")}
                >
                  <i className="bi bi-house me-2"></i>
                  Назад на головну
                </Button>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Published Routes */}
      {routes.length > 0 && (
        <Row className="mb-5">
          <Col lg={8} className="mx-auto">
            <h5
              className="mb-4"
              style={{ fontSize: "18px", fontWeight: "bold" }}
            >
              Опубліковані маршрути
            </h5>
            {routes.map((route) => (
              <Card key={route.id} className="mb-3 shadow-sm">
                <Card.Body>
                  <Card.Title className="mb-2">{route.name}</Card.Title>
                  {route.description && (
                    <Card.Text className="text-muted mb-3">
                      {route.description}
                    </Card.Text>
                  )}
                  <div className="d-flex justify-content-between">
                    <span>
                      <strong>
                        {route.statistics?.distanceKm.toFixed(1)} км
                      </strong>
                    </span>
                    <span>
                      <strong>
                        {route.statistics?.estimatedTimeMinutes} хв
                      </strong>
                    </span>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </Col>
        </Row>
      )}
    </Container>
  );
}

export default ViewUserProfile;
