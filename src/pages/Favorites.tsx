import { useState, useEffect } from "react";
import { Button, Alert, Spinner, Card, Row, Col, Nav } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import * as supabaseModules from "../services/supabaseService";
import MapPreview from "../Components/MapPreview";

interface RouteItem {
  id: string;
  name: string;
  description?: string;
  distance_km?: number;
  is_public?: boolean;
  created_at: string;
  user_id?: string;
  points?: [number, number][];
}

function Favorites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [favoriteRoutes, setFavoriteRoutes] = useState<RouteItem[]>([]);
  const [publicRoutes, setPublicRoutes] = useState<RouteItem[]>([]);
  const [myPublishedRoutes, setMyPublishedRoutes] = useState<RouteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "favorites" | "public" | "myPublished"
  >("favorites");
  const [publishing, setPublishing] = useState(false);

  // Завантажити улюблені маршрути
  useEffect(() => {
    if (!user) return;

    const loadFavorites = async () => {
      try {
        setLoading(true);
        setError(null);
        const routes = await supabaseModules.getFavoriteRoutes(user.id);
        setFavoriteRoutes(routes as unknown as RouteItem[]);
      } catch (err) {
        console.error("Error loading favorites:", err);
        setError("Помилка завантаження улюблених маршрутів");
        setFavoriteRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadFavorites();
  }, [user]);

  // Завантажити публічні маршрути
  useEffect(() => {
    const loadPublicRoutes = async () => {
      try {
        setLoading(true);
        setError(null);
        const routes = await supabaseModules.getPublicRoutes();
        setPublicRoutes(routes as RouteItem[]);
      } catch (err) {
        console.error("Error loading public routes:", err);
        setError("Помилка завантаження публічних маршрутів");
        setPublicRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadPublicRoutes();
  }, []);

  // Завантажити мої опубліковані маршрути
  useEffect(() => {
    if (!user) return;

    const loadMyPublished = async () => {
      try {
        setLoading(true);
        setError(null);
        const routes = await supabaseModules.getMyPublishedRoutes();
        setMyPublishedRoutes(routes as unknown as RouteItem[]);
      } catch (err) {
        console.error("Error loading my published routes:", err);
        setError("Помилка завантаження моїх опублікованих маршрутів");
        setMyPublishedRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    loadMyPublished();
  }, [user]);

  const handleRemoveFavorite = async (routeId: string) => {
    if (!user) return;
    try {
      await supabaseModules.removeFromFavorites(routeId);
      setFavoriteRoutes(favoriteRoutes.filter((r) => r.id !== routeId));
    } catch (err) {
      setError("Помилка видалення з улюблених");
      console.error(err);
    }
  };

  const handleAddFavorite = async (routeId: string) => {
    if (!user) return;
    try {
      await supabaseModules.addToFavorites(routeId);
      // Додати маршрут до локального стану, щоб не перезавантажувати зі скрипу
      const routes = await supabaseModules.getFavoriteRoutes(user.id);
      setFavoriteRoutes(routes as unknown as RouteItem[]);
    } catch (err) {
      console.error("Error adding to favorites:", err);
      setError("Помилка додавання в улюблені");
      // Видалимо повідомлення про помилку через 3 секунди
      setTimeout(() => setError(null), 3000);
    }
  };

  const handlePublishRoute = async (routeId: string) => {
    try {
      setPublishing(true);
      await supabaseModules.publishRoute(routeId);
      // Оновити улюблені маршрути
      const routes = await supabaseModules.getFavoriteRoutes(user!.id);
      setFavoriteRoutes(routes as unknown as RouteItem[]);
      // Оновити мої опубліковані маршрути
      const published = await supabaseModules.getMyPublishedRoutes();
      setMyPublishedRoutes(published as unknown as RouteItem[]);
      setError(null);
    } catch (err) {
      console.error("Error publishing route:", err);
      setError("Помилка при публікуванні маршруту");
      setTimeout(() => setError(null), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublishRoute = async (routeId: string) => {
    try {
      setPublishing(true);
      await supabaseModules.unpublishRoute(routeId);
      // Оновити мої опубліковані маршрути
      const published = await supabaseModules.getMyPublishedRoutes();
      setMyPublishedRoutes(published as unknown as RouteItem[]);
      setError(null);
    } catch (err) {
      console.error("Error unpublishing route:", err);
      setError("Помилка при видаленні з публічних");
      setTimeout(() => setError(null), 3000);
    } finally {
      setPublishing(false);
    }
  };

  const handleViewRoute = (route: RouteItem) => {
    // Зберегти маршрут для перегляду
    if (route.points && Array.isArray(route.points)) {
      localStorage.setItem(
        "routeToView",
        JSON.stringify({
          name: route.name,
          description: route.description,
          points: route.points,
          distance_km: route.distance_km,
        })
      );
    }
    // Перенаправити на домашню сторінку
    navigate("/");
  };

  const renderRouteCard = (
    route: RouteItem,
    isFavorite: boolean,
    isMyPublished: boolean = false
  ) => (
    <Col md={4} sm={6} xs={12} key={route.id} className="mb-3">
      <Card className="h-100 shadow-sm">
        <MapPreview
          points={route.points}
          isPublic={route.is_public}
          height={200}
        />
        <Card.Body>
          <Card.Title className="text-truncate">{route.name}</Card.Title>
          <Card.Text className="text-muted small">
            {route.description || "Без опису"}
          </Card.Text>

          <div className="mb-2">
            <small className="text-muted d-block">
              <i className="bi bi-arrows-angle-expand"></i>{" "}
              {(route.distance_km || 0).toFixed(1)} км
            </small>
            <small className="text-muted d-block">
              <i className="bi bi-calendar"></i>{" "}
              {new Date(route.created_at).toLocaleDateString("uk-UA")}
            </small>
            {route.is_public && (
              <small className="badge bg-success">
                <i className="bi bi-globe"></i> Публічний
              </small>
            )}
          </div>

          <div className="d-grid gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleViewRoute(route)}
            >
              <i className="bi bi-map"></i> Переглянути на карті
            </Button>

            {!route.is_public && !isMyPublished && (
              <Button
                variant="success"
                size="sm"
                onClick={() => handlePublishRoute(route.id)}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Публікування...
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-up"></i> Опублікувати
                  </>
                )}
              </Button>
            )}

            {isMyPublished ? (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleUnpublishRoute(route.id)}
                disabled={publishing}
              >
                {publishing ? (
                  <>
                    <Spinner
                      as="span"
                      animation="border"
                      size="sm"
                      role="status"
                      aria-hidden="true"
                      className="me-2"
                    />
                    Видалення...
                  </>
                ) : (
                  <>
                    <i className="bi bi-cloud-arrow-down"></i> З публічних
                  </>
                )}
              </Button>
            ) : isFavorite ? (
              <Button
                variant="outline-danger"
                size="sm"
                onClick={() => handleRemoveFavorite(route.id)}
              >
                <i className="bi bi-heart-fill"></i> З улюблених
              </Button>
            ) : (
              <Button
                variant="outline-success"
                size="sm"
                onClick={() => handleAddFavorite(route.id)}
              >
                <i className="bi bi-heart"></i> Улюблені
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>
    </Col>
  );

  if (!user) {
    return (
      <div className="px-3">
        <Alert variant="info" className="mt-3">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Потрібна авторизація
          </Alert.Heading>
          <p>Для перегляду маршрутів потрібно увійти у свій аккаунт.</p>
        </Alert>
      </div>
    );
  }

  return (
    <div className="px-3 py-3">
      <h1 className="mb-4">
        <i className="bi bi-heart-fill text-danger me-2"></i>
        Маршрути
      </h1>

      {error && <Alert variant="danger">{error}</Alert>}

      <Nav variant="tabs" className="mb-4">
        <Nav.Item>
          <Nav.Link
            active={activeTab === "favorites"}
            onClick={() => setActiveTab("favorites")}
          >
            <i className="bi bi-heart me-2"></i>
            Улюблені ({favoriteRoutes.length})
          </Nav.Link>
        </Nav.Item>
        <Nav.Item>
          <Nav.Link
            active={activeTab === "public"}
            onClick={() => setActiveTab("public")}
          >
            <i className="bi bi-globe me-2"></i>
            Публічні ({publicRoutes.length})
          </Nav.Link>
        </Nav.Item>
        {user && (
          <Nav.Item>
            <Nav.Link
              active={activeTab === "myPublished"}
              onClick={() => setActiveTab("myPublished")}
            >
              <i className="bi bi-cloud-check me-2"></i>
              Мої опубліковані ({myPublishedRoutes.length})
            </Nav.Link>
          </Nav.Item>
        )}
      </Nav>

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" variant="success" />
        </div>
      ) : activeTab === "favorites" ? (
        <>
          {favoriteRoutes.length === 0 ? (
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>У вас поки немає
              улюблених маршрутів.
            </Alert>
          ) : (
            <Row>
              {favoriteRoutes.map((route) => renderRouteCard(route, true))}
            </Row>
          )}
        </>
      ) : activeTab === "public" ? (
        <>
          {publicRoutes.length === 0 ? (
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              Публічних маршрутів поки немає.
            </Alert>
          ) : (
            <Row>
              {publicRoutes.map((route) => renderRouteCard(route, false))}
            </Row>
          )}
        </>
      ) : (
        <>
          {myPublishedRoutes.length === 0 ? (
            <Alert variant="info">
              <i className="bi bi-info-circle me-2"></i>
              Ви поки не опублікували жодного маршруту.
            </Alert>
          ) : (
            <Row>
              {myPublishedRoutes.map((route) =>
                renderRouteCard(route, false, true)
              )}
            </Row>
          )}
        </>
      )}
    </div>
  );
}

export default Favorites;
