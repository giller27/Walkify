import React, { useState } from "react";
import { RouteFilterOptions } from "../services/routeService";

interface WalkFiltersMenuProps {
  onGenerate: (filters: RouteFilterOptions) => void;
  isGenerating: boolean;
}

const AVAILABLE_CATEGORIES = [
  { id: "park", label: "Парки та природа", emoji: "🌳" },
  { id: "cafe", label: "Кав'ярні", emoji: "☕" },
  { id: "restaurant", label: "Ресторани", emoji: "🍽️" },
  { id: "museum", label: "Музеї та культура", emoji: "🏛️" },
  { id: "library", label: "Бібліотеки", emoji: "📚" },
  { id: "church", label: "Храми та архітектура", emoji: "⛪" },
  { id: "tourist_attraction", label: "Визначні місця", emoji: "⭐" },
];

const WalkFiltersMenu: React.FC<WalkFiltersMenuProps> = ({ onGenerate, isGenerating }) => {
  const [routeMode, setRouteMode] = useState<"exploration" | "point_to_point">("exploration");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["park", "cafe"]);
  const [targetDistanceKm, setTargetDistanceKm] = useState<number>(4);
  const [desiredPoiCount, setDesiredPoiCount] = useState<number>(4);
  const [minRating, setMinRating] = useState<number>(4.0);

  const toggleCategory = (id: string) => {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedCategories.length === 0) {
      alert("Будь ласка, оберіть хоча б одну категорію для пошуку точок!");
      return;
    }
    onGenerate({
      routeMode,
      categories: selectedCategories,
      desiredPoiCount,
      targetDistanceKm,
      minRating,
    });
  };

  return (
    <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
      <h5 className="fw-bold mb-3 text-dark">
        <i className="bi bi-sliders me-2 text-success"></i> Параметри прогулянки
      </h5>
      <form onSubmit={handleSubmit}>
        
        {/* Режим маршруту */}
        <div className="mb-4">
          <label className="form-label small fw-bold text-secondary text-uppercase">Тип маршруту</label>
          <div className="btn-group w-100" role="group">
            <button
              type="button"
              className={`btn rounded-start-3 py-2 ${routeMode === "exploration" ? "btn-success" : "btn-outline-secondary"}`}
              onClick={() => setRouteMode("exploration")}
            >
              🔄 Кільцевий (Прогулянка)
            </button>
            <button
              type="button"
              className={`btn rounded-end-3 py-2 ${routeMode === "point_to_point" ? "btn-success" : "btn-outline-secondary"}`}
              onClick={() => setRouteMode("point_to_point")}
            >
              📍 Прямий (До точки)
            </button>
          </div>
        </div>

        {/* Категорії місць */}
        <div className="mb-4">
          <label className="form-label small fw-bold text-secondary text-uppercase mb-2">Що хочеться відвідати?</label>
          <div className="d-flex flex-wrap gap-2">
            {AVAILABLE_CATEGORIES.map((cat) => {
              const isSelected = selectedCategories.includes(cat.id);
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`btn btn-sm rounded-pill px-3 py-2 transition-all ${
                    isSelected 
                      ? "btn-success shadow-sm" 
                      : "btn-light border text-secondary"
                  }`}
                  style={{ fontSize: "0.85rem", fontWeight: 500 }}
                >
                  <span className="me-1">{cat.emoji}</span> {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Цільова відстань */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-secondary text-uppercase m-0">Бажана відстань</label>
            <span className="badge bg-success-subtle text-success rounded-pill fw-bold fs-6 px-2">
              {targetDistanceKm} км
            </span>
          </div>
          <input
            type="range"
            className="form-range custom-range"
            min="1"
            max="15"
            step="0.5"
            value={targetDistanceKm}
            onChange={(e) => setTargetDistanceKm(parseFloat(e.target.value))}
          />
        </div>

        {/* Кількість зупинок */}
        <div className="mb-3">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-secondary text-uppercase m-0">Кількість цікавих зупинок</label>
            <span className="badge bg-primary-subtle text-primary rounded-pill fw-bold fs-6 px-2">
              {desiredPoiCount}
            </span>
          </div>
          <input
            type="range"
            className="form-range"
            min="1"
            max="8"
            step="1"
            value={desiredPoiCount}
            onChange={(e) => setDesiredPoiCount(parseInt(e.target.value))}
          />
        </div>

        {/* Мінімальний рейтинг місць */}
        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-secondary text-uppercase m-0">Мінімальний рейтинг Google</label>
            <span className="badge bg-warning-subtle text-warning-depth rounded-pill fw-bold fs-6 px-2" style={{color: '#b27b00'}}>
              ★ {minRating.toFixed(1)}
            </span>
          </div>
          <input
            type="range"
            className="form-range"
            min="3.0"
            max="4.8"
            step="0.1"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value))}
          />
        </div>

        {/* Кнопка запуску */}
        <button
          type="submit"
          className="btn btn-success w-100 py-2.5 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              Аналізуємо локації та висоти...
            </>
          ) : (
            <>
              <i className="bi bi-geo-alt-fill"></i> Сформувати ідеальний маршрут
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default WalkFiltersMenu;