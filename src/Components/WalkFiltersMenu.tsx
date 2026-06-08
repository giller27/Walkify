import React, { useState, useEffect } from "react";
import { RouteFilterOptions, RouteDestination } from "../services/routeService";

interface WalkFiltersMenuProps {
  onGenerate: (filters: RouteFilterOptions) => void;
  isGenerating: boolean;
  destination?: RouteDestination | null;
  onDestinationChange?: (dest: RouteDestination | null) => void;
  onPickOnMap?: () => void;
  isPickingOnMap?: boolean;
}

const AVAILABLE_CATEGORIES = [
  { id: "park", label: "Парки та природа", emoji: "🌳" },
  { id: "cafe", label: "Кав'ярні", emoji: "☕" },
  { id: "restaurant", label: "Ресторани", emoji: "🍽️" },
  { id: "bakery", label: "Пекарні", emoji: "🥐" },
  { id: "museum", label: "Музеї", emoji: "🏛️" },
  { id: "art_gallery", label: "Галереї", emoji: "🎨" },
  { id: "library", label: "Бібліотеки", emoji: "📚" },
  { id: "book_store", label: "Книгарні", emoji: "📖" },
  { id: "church", label: "Храми", emoji: "⛪" },
  { id: "tourist_attraction", label: "Визначні місця", emoji: "⭐" },
  { id: "store", label: "Магазини", emoji: "🛍️" },
  { id: "shopping_mall", label: "Торгові центри", emoji: "🏬" },
  { id: "gym", label: "Спортзали", emoji: "💪" },
  { id: "spa", label: "СПА та велнес", emoji: "🧖" },
  { id: "zoo", label: "Зоопарки", emoji: "🦁" },
  { id: "stadium", label: "Стадіони", emoji: "🏟️" },
  { id: "movie_theater", label: "Кінотеатри", emoji: "🎬" },
  { id: "night_club", label: "Бари та клуби", emoji: "🎵" },
  { id: "playground", label: "Майданчики", emoji: "🛝" },
];

const WalkFiltersMenu: React.FC<WalkFiltersMenuProps> = ({
  onGenerate,
  isGenerating,
  destination,
  onDestinationChange,
  onPickOnMap,
  isPickingOnMap,
}) => {
  const [routeMode, setRouteMode] = useState<"exploration" | "point_to_point">("exploration");
  const [selectedCategories, setSelectedCategories] = useState<string[]>(["park", "cafe"]);
  const [targetTimeMinutes, setTargetTimeMinutes] = useState<number>(60);
  const [destinationAddress, setDestinationAddress] = useState<string>("");

  useEffect(() => {
    if (destination?.address) {
      setDestinationAddress(destination.address);
    }
  }, [destination?.address]);

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

    if (routeMode === "point_to_point") {
      const hasMapPoint = !!destination?.coords;
      const hasAddress = destinationAddress.trim().length > 0;
      if (!hasMapPoint && !hasAddress) {
        alert("Вкажіть адресу призначення або оберіть точку на карті.");
        return;
      }
    }

    const dest: RouteDestination | undefined = routeMode === "point_to_point"
      ? destination?.coords
        ? destination
        : { address: destinationAddress.trim() }
      : undefined;

    onGenerate({
      routeMode,
      categories: selectedCategories,
      targetTimeMinutes,
      destination: dest,
    });
  };

  const handleAddressChange = (value: string) => {
    setDestinationAddress(value);
    if (onDestinationChange) {
      onDestinationChange(value ? { address: value } : null);
    }
  };

  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins} хв`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h} год ${m} хв` : `${h} год`;
  };

  return (
    <div className="card shadow-sm border-0 rounded-4 p-4 bg-white">
      <h5 className="fw-bold mb-3 text-dark">
        <i className="bi bi-sliders me-2 text-success"></i> Параметри прогулянки
      </h5>
      <form onSubmit={handleSubmit}>

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

        {routeMode === "point_to_point" && (
          <div className="mb-4">
            <label className="form-label small fw-bold text-secondary text-uppercase mb-2">
              Куди йти?
            </label>
            <input
              type="text"
              className="form-control rounded-3 mb-2"
              placeholder="Введіть адресу, напр. вул. Хрещатик, 1"
              value={destinationAddress}
              onChange={(e) => handleAddressChange(e.target.value)}
            />
            <button
              type="button"
              className={`btn w-100 rounded-3 py-2 ${isPickingOnMap ? "btn-warning" : "btn-outline-success"}`}
              onClick={onPickOnMap}
            >
              <i className="bi bi-crosshair me-2"></i>
              {isPickingOnMap ? "Клікніть на карті..." : "Обрати точку на карті"}
            </button>
            {destination?.coords && destination.address && (
              <div className="alert alert-success-subtle border-0 rounded-3 small mt-2 mb-0 py-2">
                <i className="bi bi-geo-alt-fill me-1"></i>
                {destination.address}
              </div>
            )}
          </div>
        )}

        <div className="mb-4">
          <label className="form-label small fw-bold text-secondary text-uppercase mb-2">
            Що хочеться відвідати?
          </label>
          <p className="text-muted small mb-2">Кожна зупинка — одна з обраних категорій по черзі</p>
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

        <div className="mb-4">
          <div className="d-flex justify-content-between align-items-center mb-1">
            <label className="form-label small fw-bold text-secondary text-uppercase m-0">
              Бажаний час прогулянки
            </label>
            <span className="badge bg-success-subtle text-success rounded-pill fw-bold fs-6 px-2">
              {formatTime(targetTimeMinutes)}
            </span>
          </div>
          <input
            type="range"
            className="form-range custom-range"
            min="15"
            max="180"
            step="15"
            value={targetTimeMinutes}
            onChange={(e) => setTargetTimeMinutes(parseInt(e.target.value))}
          />
          <div className="d-flex justify-content-between small text-muted">
            <span>15 хв</span>
            <span>3 год</span>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-success w-100 py-2.5 rounded-3 fw-bold shadow-sm d-flex align-items-center justify-content-center gap-2"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              Будуємо маршрут...
            </>
          ) : (
            <>
              <i className="bi bi-geo-alt-fill"></i> Сформувати маршрут
            </>
          )}
        </button>
      </form>
    </div>
  );
};

export default WalkFiltersMenu;
