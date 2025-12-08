import { useState, useEffect } from "react";
import { Form, Button, InputGroup, Modal, Alert } from "react-bootstrap";
import { WalkPreferences } from "../Components/WalkPreferences";
import map from "../assets/images/map.jpg";

export interface SavedRoute {
  id: string;
  name: string;
  preferences: WalkPreferences;
  createdAt: string;
  userEmail: string;
}

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function Favorites() {
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState<number | undefined>(undefined);
  const [prompt, setPrompt] = useState<string>("");
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);

  // Завантажити інформацію користувача
  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        setUserInfo(user);
      } catch (e) {
        console.error("Помилка завантаження інформації користувача:", e);
      }
    }
  }, []);

  // Завантажити збережені маршрути з localStorage для поточного користувача
  useEffect(() => {
    if (!userInfo?.email) {
      setSavedRoutes([]);
      return;
    }

    // Завантажити всі маршрути з localStorage
    const allRoutesStr = localStorage.getItem("savedRoutes");
    if (allRoutesStr) {
      try {
        const allRoutes: SavedRoute[] = JSON.parse(allRoutesStr);
        // Фільтрувати маршрути для поточного користувача
        const userRoutes = allRoutes.filter(
          (route) => route.userEmail === userInfo.email
        );
        setSavedRoutes(userRoutes);
      } catch (e) {
        console.error("Помилка завантаження збережених маршрутів:", e);
      }
    }
  }, [userInfo]);

  // Зберегти маршрути в localStorage (зберігаємо всі маршрути всіх користувачів)
  const saveRoutesToStorage = (routes: SavedRoute[]) => {
    // Завантажити всі існуючі маршрути
    const allRoutesStr = localStorage.getItem("savedRoutes");
    let allRoutes: SavedRoute[] = [];
    if (allRoutesStr) {
      try {
        allRoutes = JSON.parse(allRoutesStr);
      } catch (e) {
        console.error("Помилка парсингу маршрутів:", e);
      }
    }

    // Видалити старі маршрути поточного користувача
    allRoutes = allRoutes.filter(
      (route) => route.userEmail !== userInfo?.email
    );

    // Додати нові маршрути поточного користувача
    allRoutes = [...allRoutes, ...routes];

    // Зберегти всі маршрути
    localStorage.setItem("savedRoutes", JSON.stringify(allRoutes));
    setSavedRoutes(routes);
  };

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput("");
    }
  };

  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLocation();
    }
  };

  const handleSaveRoute = () => {
    if (!userInfo?.email) {
      alert("Будь ласка, увійдіть у свій профіль для збереження маршрутів");
      return;
    }

    if (!routeName.trim()) {
      alert("Будь ласка, введіть назву маршруту");
      return;
    }

    if (!prompt.trim() && locations.length === 0) {
      alert("Будь ласка, введіть промпт або додайте місця");
      return;
    }

    const newRoute: SavedRoute = {
      id: Date.now().toString(),
      name: routeName,
      preferences: {
        locations,
        distanceKm: distanceKm && distanceKm > 0 ? distanceKm : undefined,
        prompt: prompt.trim() || undefined,
      },
      createdAt: new Date().toISOString(),
      userEmail: userInfo.email,
    };

    const updatedRoutes = [...savedRoutes, newRoute];
    saveRoutesToStorage(updatedRoutes);

    // Очистити форму
    setRouteName("");
    setLocationInput("");
    setLocations([]);
    setDistanceKm(undefined);
    setPrompt("");
    setShowModal(false);
  };

  const handleDeleteRoute = (id: string) => {
    if (window.confirm("Ви впевнені, що хочете видалити цей маршрут?")) {
      const updatedRoutes = savedRoutes.filter((route) => route.id !== id);
      saveRoutesToStorage(updatedRoutes);
    }
  };

  const handleUseRoute = (route: SavedRoute) => {
    // Перейти на Home і передати маршрут (можна використати state або localStorage)
    localStorage.setItem("routeToLoad", JSON.stringify(route.preferences));
    window.location.href = "/home";
  };

  if (!userInfo) {
    return (
      <div style={{ paddingBottom: "80px" }} className="px-3">
        <Alert variant="info" className="mt-3">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Потрібна авторизація
          </Alert.Heading>
          <p>
            Для збереження та перегляду маршрутів потрібно увійти через Google.
          </p>
          <hr />
          <p className="mb-0">
            <a href="/prof" className="btn btn-success">
              Перейти до профілю
            </a>
          </p>
        </Alert>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: "80px" }}>
      <div className="d-flex justify-content-between align-items-center mb-3 px-3">
        <h1 className="text-center lh-lg mb-0" style={{ flex: 1 }}>
          Улюблені маршрути
        </h1>
        <Button
          variant="success"
          onClick={() => setShowModal(true)}
          className="ms-3"
        >
          <i className="bi bi-plus-circle me-2"></i>
          Створити швидкий маршрут
        </Button>
      </div>

      {savedRoutes.length === 0 ? (
        <div className="text-center text-muted mt-5">
          <i className="bi bi-heart" style={{ fontSize: "3rem" }}></i>
          <p className="mt-3">У вас поки немає збережених маршрутів</p>
          <p className="small">Створіть швидкий маршрут для швидкого доступу</p>
        </div>
      ) : (
        <div className="d-flex flex-wrap justify-content-md-center px-3">
          {savedRoutes.map((route) => (
            <div
              key={route.id}
              className="card m-2 mt-1 shadow"
              style={{ width: "20rem" }}
            >
              <img
                src={map}
                className="card-img-top m-3 rounded-1 shadow"
                style={{ height: "112px", width: "250px", objectFit: "cover" }}
                alt="map"
              />
              <div className="card-body">
                <h5 className="card-title">{route.name}</h5>
                <p className="card-text small text-muted">
                  {route.preferences.prompt || "Без опису"}
                </p>
                {route.preferences.locations.length > 0 && (
                  <div className="mb-2">
                    {route.preferences.locations.slice(0, 3).map((loc, idx) => (
                      <span
                        key={idx}
                        className="badge bg-success me-1 mb-1"
                        style={{ fontSize: "0.7rem" }}
                      >
                        {loc}
                      </span>
                    ))}
                    {route.preferences.locations.length > 3 && (
                      <span className="text-muted small">
                        +{route.preferences.locations.length - 3}
                      </span>
                    )}
                  </div>
                )}
                {route.preferences.distanceKm && route.preferences.distanceKm > 0 && (
                  <p className="small text-muted mb-2">
                    <i className="bi bi-arrows-angle-expand"></i>{" "}
                    {route.preferences.distanceKm} км
                  </p>
                )}
                <div className="d-flex gap-2">
                  <Button
                    variant="success"
                    size="sm"
                    onClick={() => handleUseRoute(route)}
                    className="flex-fill"
                  >
                    <i className="bi bi-play-fill me-1"></i>
                    Використати
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => handleDeleteRoute(route.id)}
                  >
                    <i className="bi bi-trash"></i>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Модальне вікно для створення швидкого маршруту */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-lightning-charge me-2"></i>
            Створити швидкий маршрут
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>
                <i className="bi bi-tag me-2"></i>
                Назва маршруту
              </Form.Label>
              <Form.Control
                type="text"
                placeholder="Наприклад: Ранкова прогулянка"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="bi bi-chat-dots me-2"></i>
                Промпт маршруту
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                placeholder="Напр.: Прогулянка на 2 години через парк з кав'ярнею"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <Form.Text className="text-muted">
                Додаткові умови: місця та час нижче
              </Form.Text>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="bi bi-geo-alt me-2"></i>
                Місця для відвідування
              </Form.Label>
              <InputGroup>
                <Form.Control
                  type="text"
                  placeholder='Наприклад: "cafe", "shop", "park"...'
                  value={locationInput}
                  onChange={(e) => setLocationInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <Button
                  variant="outline-success"
                  onClick={addLocation}
                  type="button"
                >
                  <i className="bi bi-plus"></i>
                </Button>
              </InputGroup>
              {locations.length > 0 && (
                <div className="mt-2 d-flex flex-wrap gap-1">
                  {locations.map((loc, idx) => (
                    <span
                      key={idx}
                      className="badge bg-success d-inline-flex align-items-center gap-1"
                    >
                      {loc}
                      <button
                        type="button"
                        className="btn-close btn-close-white"
                        style={{ fontSize: "0.7em" }}
                        onClick={() => removeLocation(idx)}
                        aria-label="Remove"
                      ></button>
                    </span>
                  ))}
                </div>
              )}
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                <i className="bi bi-arrows-angle-expand me-2"></i>
                Відстань (км)
              </Form.Label>
              <Form.Control
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                value={distanceKm || ""}
                onChange={(e) => setDistanceKm(e.target.value ? Number(e.target.value) : undefined)}
                placeholder="Автоматично"
              />
              <Form.Text className="text-muted">
                Якщо не вказано, відстань визначається автоматично з промпту
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Скасувати
          </Button>
          <Button variant="success" onClick={handleSaveRoute}>
            <i className="bi bi-save me-2"></i>
            Зберегти маршрут
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default Favorites;
