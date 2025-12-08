import { useState, useEffect } from "react";
import { Card, Row, Col, Alert } from "react-bootstrap";

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

export interface RouteStatistic {
  id: string;
  userEmail: string;
  distanceKm: number;
  locations: string[];
  prompt?: string;
  completedAt: string;
  estimatedTimeMinutes?: number;
}

function Statistic() {
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);
  const [statistics, setStatistics] = useState<RouteStatistic[]>([]);
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");

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

  // Завантажити статистику для поточного користувача
  useEffect(() => {
    if (!userInfo?.email) {
      setStatistics([]);
      return;
    }

    const allStatsStr = localStorage.getItem("routeStatistics");
    if (allStatsStr) {
      try {
        const allStats: RouteStatistic[] = JSON.parse(allStatsStr);
        const userStats = allStats.filter(
          (stat) => stat.userEmail === userInfo.email
        );
        setStatistics(userStats);
      } catch (e) {
        console.error("Помилка завантаження статистики:", e);
      }
    }
  }, [userInfo]);

  // Фільтрувати статистику за вибраним періодом
  const filteredStatistics = statistics.filter((stat) => {
    if (timeRange === "all") return true;
    const statDate = new Date(stat.completedAt);
    const now = new Date();
    const diffTime = now.getTime() - statDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (timeRange === "week") return diffDays <= 7;
    if (timeRange === "month") return diffDays <= 30;
    return true;
  });

  // Розрахунок метрик
  const totalDistance = filteredStatistics.reduce(
    (sum, stat) => sum + stat.distanceKm,
    0
  );
  const totalRoutes = filteredStatistics.length;
  const averageDistance =
    totalRoutes > 0 ? totalDistance / totalRoutes : 0;
  const totalTimeMinutes = filteredStatistics.reduce(
    (sum, stat) => sum + (stat.estimatedTimeMinutes || 0),
    0
  );
  const totalTimeHours = totalTimeMinutes / 60;

  // Найпопулярніші місця
  const locationCounts: { [key: string]: number } = {};
  filteredStatistics.forEach((stat) => {
    stat.locations.forEach((loc) => {
      locationCounts[loc] = (locationCounts[loc] || 0) + 1;
    });
  });
  const popularLocations = Object.entries(locationCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));

  // Статистика по днях тижня
  const dayStats: { [key: string]: number } = {
    Понеділок: 0,
    Вівторок: 0,
    Середа: 0,
    Четвер: 0,
    "П'ятниця": 0,
    Субота: 0,
    Неділя: 0,
  };

  filteredStatistics.forEach((stat) => {
    const date = new Date(stat.completedAt);
    const dayNames = [
      "Неділя",
      "Понеділок",
      "Вівторок",
      "Середа",
      "Четвер",
      "П'ятниця",
      "Субота",
    ];
    const dayName = dayNames[date.getDay()];
    dayStats[dayName] = (dayStats[dayName] || 0) + 1;
  });

  if (!userInfo) {
    return (
      <div style={{ paddingBottom: "80px" }} className="px-3">
        <Alert variant="info" className="mt-3">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Потрібна авторизація
          </Alert.Heading>
          <p>
            Для перегляду статистики потрібно увійти через Google.
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
    <div style={{ paddingBottom: "80px" }} className="px-3">
      <div className="d-flex justify-content-between align-items-center mb-4 mt-3">
        <h1 className="mb-0">
          <i className="bi bi-graph-up me-2"></i>
          Статистика
        </h1>
        <div className="btn-group" role="group">
          <input
            type="radio"
            className="btn-check"
            name="timeRange"
            id="all"
            checked={timeRange === "all"}
            onChange={() => setTimeRange("all")}
          />
          <label className="btn btn-outline-success" htmlFor="all">
            Всі
          </label>

          <input
            type="radio"
            className="btn-check"
            name="timeRange"
            id="week"
            checked={timeRange === "week"}
            onChange={() => setTimeRange("week")}
          />
          <label className="btn btn-outline-success" htmlFor="week">
            Тиждень
          </label>

          <input
            type="radio"
            className="btn-check"
            name="timeRange"
            id="month"
            checked={timeRange === "month"}
            onChange={() => setTimeRange("month")}
          />
          <label className="btn btn-outline-success" htmlFor="month">
            Місяць
          </label>
        </div>
      </div>

      {totalRoutes === 0 ? (
        <Alert variant="secondary" className="mt-4">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Немає даних
          </Alert.Heading>
          <p>
            У вас поки немає статистики. Створіть та використайте маршрути,
            щоб побачити свою статистику тут.
          </p>
        </Alert>
      ) : (
        <>
          {/* Основні метрики */}
          <Row className="g-3 mb-4">
            <Col xs={12} sm={6} md={3}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-route"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Всього маршрутів
                  </Card.Title>
                  <h2 className="mb-0">{totalRoutes}</h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-arrows-angle-expand"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Загальна відстань
                  </Card.Title>
                  <h2 className="mb-0">{totalDistance.toFixed(1)} км</h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-speedometer2"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Середня відстань
                  </Card.Title>
                  <h2 className="mb-0">{averageDistance.toFixed(1)} км</h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} md={3}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-clock"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Загальний час
                  </Card.Title>
                  <h2 className="mb-0">
                    {totalTimeHours > 0
                      ? `${totalTimeHours.toFixed(1)} год`
                      : `${totalTimeMinutes.toFixed(0)} хв`}
                  </h2>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-3">
            {/* Найпопулярніші місця */}
            <Col xs={12} md={6}>
              <Card className="h-100">
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-star-fill me-2"></i>
                    Найпопулярніші місця
                  </h5>
                </Card.Header>
                <Card.Body>
                  {popularLocations.length > 0 ? (
                    <div>
                      {popularLocations.map((item, idx) => (
                        <div
                          key={idx}
                          className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom"
                        >
                          <div className="d-flex align-items-center">
                            <span className="badge bg-success me-2">
                              {idx + 1}
                            </span>
                            <span className="fw-bold">{item.location}</span>
                          </div>
                          <span className="text-muted">
                            {item.count} {item.count === 1 ? "раз" : "разів"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted text-center mb-0">
                      Немає даних про місця
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Статистика по днях тижня */}
            <Col xs={12} md={6}>
              <Card className="h-100">
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-calendar-week me-2"></i>
                    Активність по днях
                  </h5>
                </Card.Header>
                <Card.Body>
                  {Object.entries(dayStats).map(([day, count]) => (
                    <div key={day} className="mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="small">{day}</span>
                        <span className="small fw-bold">{count}</span>
                      </div>
                      <div className="progress" style={{ height: "8px" }}>
                        <div
                          className="progress-bar bg-success"
                          role="progressbar"
                          style={{
                            width: `${
                              totalRoutes > 0
                                ? (count / totalRoutes) * 100
                                : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>

            {/* Останні маршрути */}
            <Col xs={12}>
              <Card>
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-clock-history me-2"></i>
                    Останні маршрути
                  </h5>
                </Card.Header>
                <Card.Body>
                  {filteredStatistics
                    .sort(
                      (a, b) =>
                        new Date(b.completedAt).getTime() -
                        new Date(a.completedAt).getTime()
                    )
                    .slice(0, 10)
                    .map((stat) => (
                      <div
                        key={stat.id}
                        className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom"
                      >
                        <div>
                          <div className="fw-bold">
                            {stat.prompt || "Маршрут без опису"}
                          </div>
                          <div className="small text-muted">
                            {new Date(stat.completedAt).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {stat.locations.length > 0 && (
                            <div className="mt-1">
                              {stat.locations.slice(0, 3).map((loc, idx) => (
                                <span
                                  key={idx}
                                  className="badge bg-success me-1"
                                  style={{ fontSize: "0.7rem" }}
                                >
                                  {loc}
                                </span>
                              ))}
                              {stat.locations.length > 3 && (
                                <span className="text-muted small">
                                  +{stat.locations.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-success">
                            {stat.distanceKm.toFixed(1)} км
                          </div>
                          {stat.estimatedTimeMinutes && (
                            <div className="small text-muted">
                              ~{Math.round(stat.estimatedTimeMinutes)} хв
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  {filteredStatistics.length === 0 && (
                    <p className="text-muted text-center mb-0">
                      Немає маршрутів за вибраний період
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}

export default Statistic;
