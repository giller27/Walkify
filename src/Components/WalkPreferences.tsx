import React, { useState, useEffect } from "react";
import { Form, Button, InputGroup } from "react-bootstrap";

export interface WalkPreferences {
  locations: string[];
  distanceKm?: number;
  prompt?: string;
}

interface WalkPreferencesProps {
  onGenerate: (preferences: WalkPreferences) => void;
  isGenerating?: boolean;
  routeSummary?: string;
  onRequestGeolocation?: () => void;
  initialPreferences?: WalkPreferences;
}

const WalkPreferencesBar: React.FC<WalkPreferencesProps> = ({
  onGenerate,
  isGenerating = false,
  routeSummary = "",
  onRequestGeolocation,
  initialPreferences,
}) => {
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>(initialPreferences?.locations || []);
  const [distanceKm, setDistanceKm] = useState<number | undefined>(initialPreferences?.distanceKm);
  const [prompt, setPrompt] = useState<string>(initialPreferences?.prompt || "");
  const [isOpen, setIsOpen] = useState(false);

  // Оновити стан, якщо initialPreferences змінився
  useEffect(() => {
    if (initialPreferences) {
      setLocations(initialPreferences.locations || []);
      setDistanceKm(initialPreferences.distanceKm);
      setPrompt(initialPreferences.prompt || "");
    }
  }, [initialPreferences]);

  const addLocation = () => {
    const trimmed = locationInput.trim();
    if (trimmed && !locations.includes(trimmed)) {
      setLocations([...locations, trimmed]);
      setLocationInput("");
    }
  };

  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Запит геолокації, якщо є обробник
    if (onRequestGeolocation) {
      onRequestGeolocation();
    }
    
    // Всі поля необов'язкові - можна генерувати маршрут без них
    onGenerate({
      locations,
      distanceKm: distanceKm && distanceKm > 0 ? distanceKm : undefined,
      prompt: prompt.trim() || undefined,
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLocation();
    }
  };

  return (
    <>
      {/* Кнопка перемикання панелі */}
      <button
        className="btn btn-success position-fixed rounded-circle"
        style={{
          bottom: isOpen ? "420px" : "80px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "48px",
          height: "48px",
          zIndex: 1100,
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
          border: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label={isOpen ? "Сховати панель налаштувань" : "Показати панель налаштувань"}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <i className={`bi bi-chevron-${isOpen ? "down" : "up"}`} style={{ fontSize: "20px" }}></i>
      </button>

      {/* Панель налаштувань */}
      <div
        className="position-fixed w-100 bg-light border-top border-success border-3"
        style={{
          bottom: isOpen ? "60px" : "-500px",
          transition: "bottom 0.3s ease-in-out",
          zIndex: 1099,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.2)",
          maxHeight: "400px",
          overflowY: "auto",
        }}
      >
        <div className="container-fluid p-3">
          <Form onSubmit={handleSubmit}>
            <div className="row g-3">
              {/* Промпт маршруту */}
              <div className="col-12">
                <Form.Label className="small fw-semibold mb-1">
                  <i className="bi bi-chat-dots me-1"></i>
                  Промпт маршруту <span className="text-muted fw-normal">(необов'язково)</span>
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="Наприклад: Прогулянка на 2 години через парк з кав'ярнею"
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPrompt(e.target.value)
                  }
                  style={{ resize: "none" }}
                />
                <Form.Text className="text-muted small">
                  Опишіть бажану прогулянку своїми словами
                </Form.Text>
              </div>

              {/* Місця для відвідування */}
              <div className="col-12 col-md-6">
                <Form.Label className="small fw-semibold mb-1">
                  <i className="bi bi-geo-alt me-1"></i>
                  Місця для відвідування <span className="text-muted fw-normal">(необов'язково)</span>
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
                    disabled={!locationInput.trim()}
                  >
                    <i className="bi bi-plus-lg"></i>
                  </Button>
                </InputGroup>
                {locations.length > 0 && (
                  <div className="mt-2 d-flex flex-wrap gap-1">
                    {locations.map((loc, idx) => (
                      <span
                        key={idx}
                        className="badge bg-success d-inline-flex align-items-center gap-1"
                        style={{ fontSize: "0.85rem" }}
                      >
                        {loc}
                        <button
                          type="button"
                          className="btn-close btn-close-white"
                          style={{ fontSize: "0.6em" }}
                          onClick={() => removeLocation(idx)}
                          aria-label="Видалити"
                        ></button>
                      </span>
                    ))}
                  </div>
                )}
                <Form.Text className="text-muted small">
                  Додайте типи місць, які хочете відвідати
                </Form.Text>
              </div>

              {/* Відстань */}
              <div className="col-12 col-md-3">
                <Form.Label className="small fw-semibold mb-1">
                  <i className="bi bi-arrows-angle-expand me-1"></i>
                  Відстань (км) <span className="text-muted fw-normal">(необов'язково)</span>
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={distanceKm || ""}
                  onChange={(e) =>
                    setDistanceKm(e.target.value ? Number(e.target.value) : undefined)
                  }
                  placeholder="Автоматично"
                />
                <Form.Text className="text-muted small">
                  Залиште порожнім для автоматичного визначення
                </Form.Text>
              </div>

              {/* Кнопка генерації */}
              <div className="col-12 col-md-3">
                <Form.Label className="small fw-semibold mb-1 d-block" style={{ visibility: "hidden" }}>
                  Генерація
                </Form.Label>
                <Button
                  variant="success"
                  type="submit"
                  className="w-100"
                  disabled={isGenerating}
                  style={{ minHeight: "38px" }}
                >
                  {isGenerating ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      ></span>
                      Генерація...
                    </>
                  ) : (
                    <>
                      <i className="bi bi-route me-2"></i>
                      Згенерувати
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Form>

          {/* Підсумок маршруту */}
          {routeSummary && (
            <div className="mt-3 p-2 bg-white border rounded small text-secondary">
              <i className="bi bi-info-circle me-1"></i>
              {routeSummary}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default WalkPreferencesBar;
