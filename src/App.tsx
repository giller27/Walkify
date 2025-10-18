import { useState } from "react";
import Alert from "./Components/Alert";
import Button from "./Components/Button";
import Navbar from "./Components/Navbar";
import Header from "./Components/Header";

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
