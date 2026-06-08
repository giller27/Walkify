import React, { useState, useEffect } from "react";
import { Container, Form, Button, Alert } from "react-bootstrap";

// Перейменували інтерфейс даних, щоб уникнути конфлікту імен
export interface WalkPreferencesData {
  prompt: string;
  locations: string[];
  distance?: number;
  duration?: number;
  routeMode?: "point_to_point" | "exploration";
}

interface WalkPreferencesProps {
  onGenerate: (preferences: WalkPreferencesData) => void;
  isGenerating: boolean;
  routeSummary?: string;
  onRequestGeolocation: () => void;
  initialPreferences?: WalkPreferencesData;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onSaveRoute?: () => void;
  onClearRoute?: () => void;
  hasRoute?: boolean;
}

const WalkPreferences: React.FC<WalkPreferencesProps> = ({
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
  const [routeMode, setRouteMode] = useState<"point_to_point" | "exploration">(
    initialPreferences?.routeMode || "exploration"
  );

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

    onGenerate({
      prompt: prompt.trim(),
      locations: [],
      routeMode,
    });
  };

  const examples = [
    "прогулянка до парку",
    "прогулянка до парку з кав'ярнею",
    "прогулянка до кав'ярні",
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
                      placeholder="Наприклад: прогулянка до парку"
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
                    style={{ borderRadius: "20px", padding: "10px 30px", fontWeight: "bold" }}
                  >
                    {isGenerating ? "Генерація..." : "Згенерувати"}
                  </Button>
                </div>

                {error && <Alert variant="danger" className="mb-2 py-2">{error}</Alert>}
                {routeSummary && <Alert variant="success" className="mb-2 py-2"><strong>Маршрут:</strong> {routeSummary}</Alert>}
              </>
            )}
          </Form>
        </Container>
      </div>

      {hasRoute && (
        <>
          <Button variant="primary" onClick={onSaveRoute} style={{ position: "fixed", bottom: "80px", left: "20px", borderRadius: "50%", zIndex: 1001 }}>
            <i className="bi bi-bookmark-fill"></i>
          </Button>
          <Button variant="danger" onClick={onClearRoute} style={{ position: "fixed", bottom: "80px", right: "20px", borderRadius: "50%", zIndex: 1001 }}>
            <i className="bi bi-trash-fill"></i>
          </Button>
        </>
      )}

      <Button variant="success" onClick={onToggleExpand} style={{ position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)", borderRadius: "50%", zIndex: 1001 }}>
        <i className={`bi bi-chevron-${isExpanded ? "down" : "up"}`}></i>
      </Button>
    </>
  );
};

export default WalkPreferences;