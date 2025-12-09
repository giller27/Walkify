import React from "react";
import Navigation from "./Components/Navigation";
import ErrorBoundary from "./Components/ErrorBoundary";

function App() {
  return (
    <ErrorBoundary>
      <Navigation />
    </ErrorBoundary>
  );
}

export default App;
