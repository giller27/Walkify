import { useState } from "react";
import Alert from "./Components/Alert";
import Button from "./Components/Button";
import Navbar from "./Components/Navbar";
import Header from "./Components/Header";
import Map from "./Components/Map";
import RouteMap from "./Components/RouteMap";

function App() {
  const [showAlert, setShowAlert] = useState(false);
  return (
    <>
      <Header></Header>
      {/* {showAlert && <Alert onClose={() => setShowAlert(false)}>Alert</Alert>}
      <Button onClicked={() => setShowAlert(true)}>OK</Button> */}

      <RouteMap />
    </>
  );
}

export default App;
