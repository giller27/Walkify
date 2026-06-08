import React, { useState } from "react";
import { parseRouteRequest } from "../services/routeService";

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
  onClearRoute?: () => void;
  hasRoute?: boolean;
}

const EXAMPLES = [
  "прогулянка через парк та кав'ярню за 90 хв",
  "до Оперного театру через музей за 1 год",
  "прогулянка: пекарня, парк, музей за 90 хв",
  "прогулянка з рестораном та визначним місцем",
];

const WalkPreferences: React.FC<WalkPreferencesProps> = ({
  onGenerate,
  isGenerating,
  onClearRoute,
  hasRoute,
}) => {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setError("");
    if (value.trim().length > 8) {
      try {
        const parsed = parseRouteRequest(value);
        const parts: string[] = [];
        if (parsed.isExplorationMode) parts.push("прогулянка");
        else parts.push("прямий");
        if (parsed.categories.length) parts.push(`місця: ${parsed.categories.join(', ')}`);
        if (parsed.destinationName) parts.push(`до: ${parsed.destinationName}`);
        parts.push(`~${parsed.targetTimeMinutes} хв`);
        setPreview(parts.join(' · '));
      } catch {
        setPreview(null);
      }
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!prompt.trim()) {
      setError("Опишіть бажану прогулянку");
      return;
    }

    const parsed = parseRouteRequest(prompt);
    if (parsed.categories.length === 0 && !parsed.destinationName) {
      setError("Додайте місця для відвідування або пункт призначення");
      return;
    }

    onGenerate({
      prompt: prompt.trim(),
      locations: [],
      routeMode: parsed.isExplorationMode ? "exploration" : "point_to_point",
      duration: parsed.targetTimeMinutes,
    });
  };

  return (
    <div className="card shadow-sm border-0 rounded-4 p-3 p-md-4 bg-white">
      <h5 className="fw-bold mb-2 text-dark">
        <i className="bi bi-chat-left-text me-2 text-success"></i> Текстовий запит
      </h5>
      <p className="text-muted small mb-3">
        Опишіть маршрут природною мовою — система знайде місця з найвищим рейтингом на шляху
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          className="form-control rounded-3 mb-2"
          rows={3}
          placeholder="Напр.: прогулянка через парк та кав'ярню за 60 хв"
          value={prompt}
          onChange={(e) => handlePromptChange(e.target.value)}
          disabled={isGenerating}
          style={{ resize: 'none', fontSize: '0.95rem' }}
        />

        {preview && (
          <div className="alert alert-success-subtle border-0 rounded-3 small py-2 mb-2">
            <i className="bi bi-check-circle me-1"></i> {preview}
          </div>
        )}

        {error && (
          <div className="alert alert-danger border-0 rounded-3 small py-2 mb-2">{error}</div>
        )}

        <div className="mb-3">
          <span className="small text-muted d-block mb-1">Приклади:</span>
          <div className="d-flex flex-wrap gap-1">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                type="button"
                className="btn btn-sm btn-light border rounded-pill text-secondary"
                style={{ fontSize: '0.75rem' }}
                onClick={() => handlePromptChange(ex)}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        <div className="d-flex gap-2">
          <button
            type="submit"
            className="btn btn-success flex-grow-1 py-2 rounded-3 fw-bold"
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <span className="spinner-border spinner-border-sm me-2"></span>
                Будуємо...
              </>
            ) : (
              <>
                <i className="bi bi-magic me-1"></i> Згенерувати
              </>
            )}
          </button>
          {hasRoute && onClearRoute && (
            <button
              type="button"
              className="btn btn-outline-danger rounded-3 px-3"
              onClick={onClearRoute}
              title="Очистити маршрут"
            >
              <i className="bi bi-trash"></i>
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default WalkPreferences;
