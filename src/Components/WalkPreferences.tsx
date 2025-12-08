import React, { useState } from "react";
import { Form, Button, InputGroup } from "react-bootstrap";

export interface WalkPreferences {
  locations: string[];
  timeMinutes: number;
  distanceKm: number;
}

interface WalkPreferencesProps {
  onGenerate: (preferences: WalkPreferences) => void;
  isGenerating?: boolean;
}

const WalkPreferencesBar: React.FC<WalkPreferencesProps> = ({
  onGenerate,
  isGenerating = false,
}) => {
  const [locationInput, setLocationInput] = useState("");
  const [locations, setLocations] = useState<string[]>([]);
  const [timeMinutes, setTimeMinutes] = useState<number>(30);
  const [distanceKm, setDistanceKm] = useState<number>(2);

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
        timeMinutes,
        distanceKm,
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
    <div
      className="bg-light border-top border-success border-2 position-fixed w-100"
      style={{
        bottom: "60px",
        zIndex: 1000,
        padding: "15px",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
      }}
    >
      <Form onSubmit={handleSubmit}>
        <div className="row g-2 align-items-end">
          <div className="col-12 col-md-4">
            <Form.Label className="small mb-1">
              <i className="bi bi-geo-alt"></i> Місця для відвідування
            </Form.Label>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Введіть назву місця..."
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

          <div className="col-6 col-md-2">
            <Form.Label className="small mb-1">
              <i className="bi bi-clock"></i> Час (хв)
            </Form.Label>
            <Form.Control
              type="number"
              min="5"
              max="300"
              step="5"
              value={timeMinutes}
              onChange={(e) => setTimeMinutes(Number(e.target.value))}
              required
            />
          </div>

          <div className="col-6 col-md-2">
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

          <div className="col-12 col-md-4">
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
                  <i className="bi bi-route"></i> Згенерувати маршрут
                </>
              )}
            </Button>
          </div>
        </div>
      </Form>
    </div>
  );
};

export default WalkPreferencesBar;

