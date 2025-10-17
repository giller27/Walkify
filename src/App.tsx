import { useState } from "react";
import Alert from "./Components/Alert";
import Button from "./Components/Button";
import Navbar from "./Components/Navbar";

function App() {
  const [showAlert, setShowAlert] = useState(false);
  return (
    <div>
      <Navbar />
      {showAlert && <Alert onClose={() => setShowAlert(false)}>Alert</Alert>}
      <Button onClicked={() => setShowAlert(true)}>OK</Button>
    </div>
  );
}

export default App;
