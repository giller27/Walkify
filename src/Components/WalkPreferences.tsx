import React, { useState } from "react";
import { Form, Button, InputGroup } from "react-bootstrap";

export interface WalkPreferences {
  locations: string[];
  distanceKm: number;
  prompt?: string;
}

interface WalkPreferencesProps {
  onGenerate: (preferences: WalkPreferences) => void;
  isGenerating?: boolean;
  routeSummary?: string;
}

const WalkPreferencesBar: React.FC<WalkPreferencesProps> = ({
  onGenerate,
  isGenerating = false,
  routeSummary = "",
}) => {
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [distanceKm, setDistanceKm] = useState<number>(2);
  const [prompt, setPrompt] = useState<string>("");
  const [isOpen, setIsOpen] = useState(false);

  const addLocation = () => {
    if (locationInput.trim() && !locations.includes(locationInput.trim())) {
      setLocations([...locations, locationInput.trim()]);
      setLocationInput("");
    }
  };

  const removeLocation = (index: number) => {
    setLocations(locations.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (locations.length > 0) {
      onGenerate({
        locations,
        distanceKm,
        prompt,
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addLocation();
    }
  };

  return (
    <>
      {/* Toggle handle */}
      <button
        className="btn btn-success position-fixed rounded-circle"
        style={{
          bottom: isOpen ? "320px" : "80px",
          left: "50%",
          transform: "translateX(-50%)",
          width: "48px",
          height: "48px",
          zIndex: 1100,
          boxShadow: "0 4px 10px rgba(0,0,0,0.25)",
        }}
        aria-label={isOpen ? "Сховати панель налаштувань" : "Показати панель налаштувань"}
        onClick={() => setIsOpen((v) => !v)}
      >
        <i className={`bi bi-chevron-${isOpen ? "down" : "up"}`}></i>
      </button>

      {/* Slide-up panel */}
      <div
        className="position-fixed w-100 bg-light border-top border-success border-3"
        style={{
          bottom: isOpen ? "60px" : "-260px",
          transition: "bottom 0.25s ease",
          zIndex: 1099,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.2)",
        }}
      >
        <div className="p-3">
          <Form onSubmit={handleSubmit}>
            <div className="row g-2 align-items-end">
              <div className="col-12 col-md-6">
                <Form.Label className="small mb-1">
                  <i className="bi bi-geo-alt"></i> Місця для відвідування
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
              </div>

              <div className="col-12 col-md-3">
                <Form.Label className="small mb-1">
                  <i className="bi bi-arrows-angle-expand"></i> Відстань (км)
                </Form.Label>
                <Form.Control
                  type="number"
                  min="0.5"
                  max="50"
                  step="0.5"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  required
                />
              </div>

              <div className="col-12 col-md-3">
                <Form.Label className="small mb-1">
                  <i className="bi bi-chat-dots"></i> Промпт маршруту
                </Form.Label>
                <Form.Control
                  as="textarea"
                  rows={1}
                  placeholder="Напр.: Прогулянка на 2 години через парк з кав'ярнею та фіналом в АТБ"
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                    setPrompt(e.target.value)
                  }
                  style={{ resize: "none" }}
                />
              </div>

              <div className="col-12 col-md-3">
                <Button
                  variant="success"
                  type="submit"
                  className="w-100"
                  disabled={locations.length === 0 || isGenerating}
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
                      <i className="bi bi-route"></i> Згенерувати
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Form>

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


