import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";

export interface WalkPreferences {
  prompt: string;
  locations: string[];
  distance?: number;
  duration?: number;
  routeMode?: "point_to_point" | "exploration";
}

interface WalkPreferencesBarProps {
  onGenerate: (preferences: WalkPreferences) => void;
  isGenerating: boolean;
  routeSummary: string;
  onRequestGeolocation: () => void;
  initialPreferences?: WalkPreferences;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSaveRoute?: () => void;
  onClearRoute?: () => void;
  hasRoute?: boolean;
}

const WalkPreferencesBar: React.FC<WalkPreferencesBarProps> = ({
  onGenerate,
  isGenerating,
  routeSummary,
  onRequestGeolocation,
  initialPreferences,
  isExpanded = true,
  onToggleExpand,
  onSaveRoute,
  onClearRoute,
  hasRoute = false,
}) => {
  const [prompt, setPrompt] = useState(initialPreferences?.prompt || "");
  const [error, setError] = useState("");
  const [routeMode, setRouteMode] = useState<
    "point_to_point" | "exploration"
  >(initialPreferences?.routeMode || "exploration");

  useEffect(() => {
    if (initialPreferences) {
      setPrompt(initialPreferences.prompt || "");
      setRouteMode(initialPreferences.routeMode || "exploration");
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
      routeMode,
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
  ];

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 45,
          left: 0,
          right: 0,
          top: "auto",
          backgroundColor: "#fff",
          borderTop: "2px solid #28a745",
          boxShadow: "0 -2px 10px rgba(0,0,0,0.1)",
          zIndex: 1000,
          paddingBottom: "15px",
          maxHeight: isExpanded ? "180px" : "0px",
          overflowY: isExpanded ? "auto" : "hidden",
          transition: "maxHeight 0.3s ease-in-out",
        }}
      >
        <Container>
          <Form onSubmit={handleSubmit}>
            {isExpanded && (
              <>
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

                <div className="d-flex align-items-center gap-2 flex-wrap mb-2">
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
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  <span className="text-muted small">Тип маршруту:</span>
                  <div className="btn-group btn-group-sm" role="group">
                    <Button
                      type="button"
                      variant={
                        routeMode === "exploration"
                          ? "success"
                          : "outline-success"
                      }
                      onClick={() => setRouteMode("exploration")}
                      disabled={isGenerating}
                      style={{ borderRadius: "15px 0 0 15px" }}
                    >
                      Прогулянковий
                    </Button>
                    <Button
                      type="button"
                      variant={
                        routeMode === "point_to_point"
                          ? "success"
                          : "outline-success"
                      }
                      onClick={() => setRouteMode("point_to_point")}
                      disabled={isGenerating}
                      style={{ borderRadius: "0 15px 15px 0" }}
                    >
                      A → B
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Form>
        </Container>
      </div>

      {hasRoute && (
        <>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onSaveRoute?.();
            }}
            style={{
              position: "fixed",
              bottom: isExpanded ? "230px" : "70px",
              left: "20px",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
              transition: "bottom 0.3s ease-in-out",
            }}
            title="Зберегти маршрут"
          >
            <i className="bi bi-bookmark-fill"></i>
          </Button>

          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              onClearRoute?.();
            }}
            style={{
              position: "fixed",
              bottom: isExpanded ? "230px" : "70px",
              right: "20px",
              borderRadius: "50%",
              width: "40px",
              height: "40px",
              padding: "0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1001,
              transition: "bottom 0.3s ease-in-out",
            }}
            title="Очистити маршрут"
          >
            <i className="bi bi-trash-fill"></i>
          </Button>
        </>
      )}

      <Button
        variant="success"
        size="sm"
        onClick={onToggleExpand}
        style={{
          position: "fixed",
          bottom: isExpanded ? "230px" : "70px",
          left: "50%",
          transform: "translateX(-50%)",
          borderRadius: "50%",
          width: "36px",
          height: "36px",
          padding: "0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1001,
          transition: "bottom 0.3s ease-in-out",
        }}
      >
        <i className={`bi bi-chevron-${isExpanded ? "down" : "up"}`}></i>
      </Button>
    </>
  );
};

export default WalkPreferencesBar;
