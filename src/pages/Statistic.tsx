import { useState, useEffect } from "react";
import { Card, Row, Col, Alert, Spinner } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import * as supabaseModules from "../services/supabaseService";

interface WalkStat {
  id?: string;
  route_id?: string;
  date: string;
  distance_km: number;
  duration_minutes: number;
  pace: number;
  notes?: string;
}

function Statistic() {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<WalkStat[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<"all" | "week" | "month">("all");

  // Завантажити статистику для поточного користувача
  useEffect(() => {
    if (!user) {
      setStatistics([]);
      return;
    }

    const loadStatistics = async () => {
      try {
        setLoading(true);
        setError(null);
        let allStats = await supabaseModules.getUserWalkStatistics(user.id);
        // Упорядковуємо по даті з найновішим першим
        allStats = allStats.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setStatistics(allStats as unknown as WalkStat[]);
      } catch (err) {
        setError("Помилка завантаження статистики");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadStatistics();
  }, [user]);

  // Фільтрувати статистику за вибраним періодом
  const filteredStatistics = statistics.filter((stat) => {
    if (timeRange === "all") return true;
    const statDate = new Date(stat.date);
    const now = new Date();
    const diffTime = now.getTime() - statDate.getTime();
    const diffDays = diffTime / (1000 * 60 * 60 * 24);

    if (timeRange === "week") return diffDays <= 7;
    if (timeRange === "month") return diffDays <= 30;
    return true;
  });

  // Розрахунок метрик
  const totalDistance = filteredStatistics.reduce(
    (sum, stat) => sum + stat.distance_km,
    0
  );
  const totalRoutes = filteredStatistics.length;
  const averageDistance = totalRoutes > 0 ? totalDistance / totalRoutes : 0;
  const totalTimeMinutes = filteredStatistics.reduce(
    (sum, stat) => sum + (stat.duration_minutes || 0),
    0
  );
  const totalTimeHours = totalTimeMinutes / 60;
  const averagePace = totalDistance > 0 ? totalTimeMinutes / totalDistance : 0;

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
    const date = new Date(stat.date);
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

  if (!user) {
    return (
      <div className="px-3">
        <Alert variant="info" className="mt-3">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Потрібна авторизація
          </Alert.Heading>
          <p>Для перегляду статистики потрібно увійти у свій аккаунт.</p>
        </Alert>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="px-3 text-center py-5">
        <Spinner animation="border" variant="success" />
      </div>
    );
  }

  return (
    <div className="px-3">
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

      {error && <Alert variant="danger">{error}</Alert>}

      {totalRoutes === 0 ? (
        <Alert variant="secondary" className="mt-4">
          <Alert.Heading>
            <i className="bi bi-info-circle me-2"></i>
            Немає даних
          </Alert.Heading>
          <p>
            У вас поки немає статистики. Завершіть прогулянки, щоб побачити свою
            статистику.
          </p>
        </Alert>
      ) : (
        <>
          {/* Основні метрики */}
          <Row
            className="g-3 mb-4"
            style={{ display: "flex", flexWrap: "wrap" }}
          >
            <Col xs={12} sm={6} style={{ flex: "0 0 20%", maxWidth: "20%" }}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-route"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Всього прогулянок
                  </Card.Title>
                  <h2 className="mb-0">{totalRoutes}</h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} style={{ flex: "0 0 20%", maxWidth: "20%" }}>
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

            <Col xs={12} sm={6} style={{ flex: "0 0 20%", maxWidth: "20%" }}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-clock"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Загальний час
                  </Card.Title>
                  <h2 className="mb-0">
                    {totalTimeHours > 1
                      ? `${totalTimeHours.toFixed(1)} год`
                      : `${totalTimeMinutes.toFixed(0)} хв`}
                  </h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} style={{ flex: "0 0 20%", maxWidth: "20%" }}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-speedometer2"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Середня швидкість
                  </Card.Title>
                  <h2 className="mb-0">
                    {(60 / averagePace).toFixed(2)} км/год
                  </h2>
                </Card.Body>
              </Card>
            </Col>

            <Col xs={12} sm={6} style={{ flex: "0 0 20%", maxWidth: "20%" }}>
              <Card className="h-100 border-success">
                <Card.Body className="text-center">
                  <div className="display-4 text-success mb-2">
                    <i className="bi bi-hourglass"></i>
                  </div>
                  <Card.Title className="text-muted small">
                    Тривалість прогулянок
                  </Card.Title>
                  <h2 className="mb-0">{averagePace.toFixed(0)} хв/км</h2>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="g-3">
            {/* Статистика по днях тижня */}
            <Col xs={12} md={4}>
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
                              totalRoutes > 0 ? (count / totalRoutes) * 100 : 0
                            }%`,
                          }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </Card.Body>
              </Card>
            </Col>

            {/* Топ дні по відстані */}
            <Col xs={12} md={4}>
              <Card className="h-100">
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-trophy me-2"></i>
                    Найбільші відстані
                  </h5>
                </Card.Header>
                <Card.Body>
                  {filteredStatistics
                    .slice()
                    .sort((a, b) => b.distance_km - a.distance_km)
                    .slice(0, 5)
                    .map((stat, idx) => (
                      <div
                        key={stat.id}
                        className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom"
                      >
                        <div className="d-flex align-items-center">
                          <span className="badge bg-success me-2">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="small text-muted">
                              {new Date(stat.date).toLocaleDateString("uk-UA")}
                            </div>
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-success">
                            {stat.distance_km.toFixed(1)} км
                          </div>
                        </div>
                      </div>
                    ))}
                  {filteredStatistics.length === 0 && (
                    <p className="text-muted text-center mb-0">Немає даних</p>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Останні прогулянки */}
            <Col xs={12} md={4}>
              <Card>
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0">
                    <i className="bi bi-clock-history me-2"></i>
                    Останні прогулянки
                  </h5>
                </Card.Header>
                <Card.Body>
                  {filteredStatistics.length > 0 ? (
                    filteredStatistics.slice(0, 10).map((stat) => (
                      <div
                        key={stat.id}
                        className="d-flex justify-content-between align-items-center mb-3 pb-3 border-bottom"
                      >
                        <div>
                          <div className="fw-bold">
                            {stat.notes || "Прогулянка"}
                          </div>
                          <div className="small text-muted">
                            {new Date(stat.date).toLocaleString("uk-UA", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <div className="text-end">
                          <div className="fw-bold text-success">
                            {stat.distance_km.toFixed(1)} км
                          </div>
                          <div className="small text-muted">
                            ~{Math.round(stat.duration_minutes)} хв
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted text-center mb-0">
                      Немає прогулянок за вибраний період
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
