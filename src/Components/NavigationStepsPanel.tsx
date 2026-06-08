import React from "react";
import { RouteStep } from "../services/routeService";

interface NavigationStepsPanelProps {
  steps: RouteStep[];
  currentStepIndex: number;
  onStepClick?: (index: number) => void;
}

const MANEUVER_ICON: Record<string, string> = {
  'turn-left': '↰',
  'turn-right': '↱',
  'turn-slight-left': '↖',
  'turn-slight-right': '↗',
  'turn-sharp-left': '⤺',
  'turn-sharp-right': '⤻',
  'uturn-left': '↩',
  'uturn-right': '↪',
  'straight': '↑',
  'ramp-left': '↰',
  'ramp-right': '↱',
  'fork-left': '↰',
  'fork-right': '↱',
  'roundabout-left': '↺',
  'roundabout-right': '↻',
  'merge': '↑',
};

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} м`;
  return `${(meters / 1000).toFixed(1)} км`;
}

const NavigationStepsPanel: React.FC<NavigationStepsPanelProps> = ({
  steps,
  currentStepIndex,
  onStepClick,
}) => {
  if (steps.length === 0) return null;

  const current = steps[Math.min(currentStepIndex, steps.length - 1)];
  const next = steps[currentStepIndex + 1];
  const icon = current.maneuver ? (MANEUVER_ICON[current.maneuver] || '→') : '→';

  return (
    <div
      className="navigation-panel shadow-lg border-0 rounded-4 overflow-hidden bg-white"
      style={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        maxWidth: 420,
        zIndex: 1100,
      }}
    >
      <div className="bg-success text-white px-3 py-2 small fw-semibold d-flex align-items-center gap-2">
        <i className="bi bi-signpost-split"></i>
        Покрокова навігація
        <span className="ms-auto badge bg-white text-success">
          {Math.min(currentStepIndex + 1, steps.length)}/{steps.length}
        </span>
      </div>

      <div className="p-3">
        <div className="d-flex gap-3 align-items-start">
          <div
            className="flex-shrink-0 d-flex align-items-center justify-content-center rounded-3 bg-success-subtle text-success fw-bold"
            style={{ width: 44, height: 44, fontSize: '1.4rem' }}
          >
            {icon}
          </div>
          <div className="flex-grow-1 min-w-0">
            <div className="fw-bold text-dark">{current.instruction}</div>
            <div className="small text-muted mt-1">
              {formatDistance(current.distanceMeters)}
              {current.durationSeconds > 0 && ` · ~${Math.max(1, Math.round(current.durationSeconds / 60))} хв`}
            </div>
          </div>
        </div>

        {next && (
          <div className="mt-3 pt-3 border-top small text-muted">
            <span className="fw-semibold text-secondary">Далі: </span>
            {next.instruction}
          </div>
        )}
      </div>

      <details className="border-top">
        <summary className="px-3 py-2 small text-secondary cursor-pointer user-select-none">
          Усі кроки ({steps.length})
        </summary>
        <div style={{ maxHeight: 180, overflowY: 'auto' }}>
          {steps.map((step, i) => (
            <button
              key={i}
              type="button"
              className={`w-100 text-start border-0 px-3 py-2 small ${
                i === currentStepIndex ? 'bg-success-subtle fw-semibold' : 'bg-white'
              } ${i < currentStepIndex ? 'text-muted' : ''}`}
              onClick={() => onStepClick?.(i)}
            >
              <span className="me-2 text-success">{i + 1}.</span>
              {step.instruction}
              <span className="text-muted ms-1">({formatDistance(step.distanceMeters)})</span>
            </button>
          ))}
        </div>
      </details>
    </div>
  );
};

export default NavigationStepsPanel;
