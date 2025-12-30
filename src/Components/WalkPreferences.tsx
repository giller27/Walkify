import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";

export interface WalkPreferences {
  prompt: string;
  locations: string[];
  distance?: number;
  duration?: number;
}

interface WalkPreferencesBarProps {
  onGenerate: (preferences: WalkPreferences) => void;
  isGenerating: boolean;
  routeSummary: string;
  onRequestGeolocation: () => void;
  initialPreferences?: WalkPreferences;
}

const WalkPreferencesBar: React.FC<WalkPreferencesBarProps> = ({
  onGenerate,
  isGenerating,
  routeSummary,
  onRequestGeolocation,
  initialPreferences,
}) => {
  const [prompt, setPrompt] = useState(initialPreferences?.prompt || "");
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialPreferences) {
      setPrompt(initialPreferences.prompt || "");
    }
  }, [initialPreferences]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!prompt.trim()) {
      setError("Будь ласка, введіть опис маршруту");
      return;
    }

    const preferences: WalkPreferences = {
      prompt: prompt.trim(),
      locations: [],
    };

    onGenerate(preferences);
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
    setError("");
  };

  const examples = [
    "прогулянка до парку",
    "прогулянка до парку з кав'ярнею",
    "прогулянка до кав'ярні",
    "прогулянка до музею",
    "прогулянка до озера",
    "прогулянка до ресторану",
    "прогулянка до СкайПарку",
  ];

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "#fff",
        borderTop: "2px solid #28a745",
        boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
        zIndex: 1000,
        padding: "15px 0",
      }}
    >
      <Container>
        <Form onSubmit={handleSubmit}>
          <div className="d-flex gap-2 mb-2">
            <Form.Group className="flex-grow-1">
              <Form.Control
                type="text"
                placeholder="Наприклад: прогулянка до парку з кав'ярнею"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setError("");
                }}
                disabled={isGenerating}
                style={{
                  borderRadius: "20px",
                  border: "2px solid #28a745",
                  padding: "10px 20px",
                }}
              />
            </Form.Group>
            <Button
              type="submit"
              variant="success"
              disabled={isGenerating}
              style={{
                borderRadius: "20px",
                padding: "10px 30px",
                fontWeight: "bold",
              }}
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
                  <i className="bi bi-geo-alt me-2"></i>
                  Згенерувати
                </>
              )}
            </Button>
          </div>

          {error && (
            <Alert variant="danger" className="mb-2 py-2">
              {error}
            </Alert>
          )}

          {routeSummary && (
            <Alert variant="success" className="mb-2 py-2">
              <strong>Маршрут згенеровано:</strong> {routeSummary}
            </Alert>
          )}

          <div className="d-flex align-items-center gap-2 flex-wrap">
            <Button
              variant="outline-primary"
              size="sm"
              onClick={onRequestGeolocation}
              disabled={isGenerating}
              style={{ borderRadius: "15px" }}
            >
              <i className="bi bi-geo-alt-fill me-1"></i>
              Моя локація
            </Button>
            <span className="text-muted small">Приклади:</span>
            {examples.map((example, index) => (
              <Button
                key={index}
                variant="outline-secondary"
                size="sm"
                onClick={() => handleExampleClick(example)}
                disabled={isGenerating}
                style={{ borderRadius: "15px", fontSize: "0.85rem" }}
              >
                {example}
              </Button>
            ))}
          </div>
        </Form>
      </Container>
    </div>
  );
};

export default WalkPreferencesBar;
