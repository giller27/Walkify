import React from "react";
import { Alert, Container } from "react-bootstrap";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Container className="py-5">
          <Alert variant="danger">
            <Alert.Heading>⚠️ Помилка конфігурації</Alert.Heading>
            <p>
              <strong>Повідомлення:</strong> {this.state.error?.message}
            </p>
            <hr />
            <p className="mb-0">
              <small>
                Будь ласка, переконайтесь, що файл <code>.env.local</code>{" "}
                містить:
                <br />
                <code>VITE_SUPABASE_URL=...</code>
                <br />
                <code>VITE_SUPABASE_ANON_KEY=...</code>
              </small>
            </p>
            <button
              className="btn btn-primary mt-3"
              onClick={() => window.location.reload()}
            >
              Перезавантажити сторінку
            </button>
          </Alert>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
