import { useState } from "react";
import Alert from "./components/Alert";
import Button from "./components/Button";
import Navbar from "./components/Navbar";
import Header from "./components/Header";

function App() {
  const [showAlert, setShowAlert] = useState(false);
  return (
    <div>
      <Header></Header>
      {showAlert && <Alert onClose={() => setShowAlert(false)}>Alert</Alert>}
      <Button onClicked={() => setShowAlert(true)}>OK</Button>
    </div>
  );
}

export default App;
