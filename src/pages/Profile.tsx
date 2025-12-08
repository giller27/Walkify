import User from "../assets/images/user.png"
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

import { GoogleLogin, googleLogout } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode" 

import { useNavigate } from "react-router-dom";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button, Modal, Alert } from "react-bootstrap";
import PersonalData from "./PersonalData";
import Security from "./Security";
import { SavedRoute } from "./Favorites";
import { RouteStatistic } from "./Statistic";


interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function Profile() {
  const navigate = useNavigate()
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importData, setImportData] = useState("");
  const [importError, setImportError] = useState("");

  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      setUserInfo(JSON.parse(storedUser));
    }
  }, []);

  function handleLogout() {
    googleLogout();
    setUserInfo(null);
    localStorage.removeItem("userInfo");
  }

  const handleExportData = () => {
    if (!userInfo?.email) {
      alert("Будь ласка, увійдіть у свій профіль");
      return;
    }

    // Зібрати всі дані користувача
    const allRoutesStr = localStorage.getItem("savedRoutes");
    const allStatsStr = localStorage.getItem("routeStatistics");
    
    let savedRoutes: SavedRoute[] = [];
    let statistics: RouteStatistic[] = [];
    
    if (allRoutesStr) {
      try {
        const allRoutes: SavedRoute[] = JSON.parse(allRoutesStr);
        savedRoutes = allRoutes.filter(route => route.userEmail === userInfo.email);
      } catch (e) {
        console.error("Помилка експорту маршрутів:", e);
      }
    }
    
    if (allStatsStr) {
      try {
        const allStats: RouteStatistic[] = JSON.parse(allStatsStr);
        statistics = allStats.filter(stat => stat.userEmail === userInfo.email);
      } catch (e) {
        console.error("Помилка експорту статистики:", e);
      }
    }

    const exportData = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      userEmail: userInfo.email,
      savedRoutes,
      statistics,
    };

    // Створити JSON файл для завантаження
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `walkify-backup-${userInfo.email}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setShowExportModal(false);
    alert("Дані успішно експортовано! Збережіть файл у Google Drive для синхронізації між пристроями.");
  };

  const handleImportData = () => {
    if (!userInfo?.email) {
      alert("Будь ласка, увійдіть у свій профіль");
      return;
    }

    try {
      const importDataParsed = JSON.parse(importData);
      
      if (!importDataParsed.userEmail || importDataParsed.userEmail !== userInfo.email) {
        setImportError("Файл належить іншому користувачу");
        return;
      }

      // Імпортувати маршрути
      if (importDataParsed.savedRoutes && Array.isArray(importDataParsed.savedRoutes)) {
        const allRoutesStr = localStorage.getItem("savedRoutes");
        let allRoutes: SavedRoute[] = [];
        if (allRoutesStr) {
          try {
            allRoutes = JSON.parse(allRoutesStr);
          } catch (e) {
            console.error("Помилка парсингу маршрутів:", e);
          }
        }

        // Видалити старі маршрути користувача
        allRoutes = allRoutes.filter(route => route.userEmail !== userInfo.email);
        
        // Додати імпортовані маршрути
        allRoutes = [...allRoutes, ...importDataParsed.savedRoutes];
        
        localStorage.setItem("savedRoutes", JSON.stringify(allRoutes));
      }

      // Імпортувати статистику
      if (importDataParsed.statistics && Array.isArray(importDataParsed.statistics)) {
        const allStatsStr = localStorage.getItem("routeStatistics");
        let allStats: RouteStatistic[] = [];
        if (allStatsStr) {
          try {
            allStats = JSON.parse(allStatsStr);
          } catch (e) {
            console.error("Помилка парсингу статистики:", e);
          }
        }

        // Видалити стару статистику користувача
        allStats = allStats.filter(stat => stat.userEmail !== userInfo.email);
        
        // Додати імпортовану статистику
        allStats = [...allStats, ...importDataParsed.statistics];
        
        localStorage.setItem("routeStatistics", JSON.stringify(allStats));
      }

      setShowImportModal(false);
      setImportData("");
      setImportError("");
      alert("Дані успішно імпортовано! Оновіть сторінку для перегляду змін.");
      window.location.reload();
    } catch (error) {
      setImportError("Помилка парсингу JSON. Перевірте формат файлу.");
      console.error("Import error:", error);
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportData(content);
    };
    reader.readAsText(file);
  };


  return (
    <div>
      {!userInfo && (
  <GoogleLogin 
    onSuccess={(credentialResponse) => {
      if (!credentialResponse.credential) {
        console.error("Missing credential");
        return;
      }

      const decoded = jwtDecode<any>(credentialResponse.credential);

      const user: GoogleUser = {
        name: decoded.name || "",
        picture: decoded.picture || "",
        email: decoded.email || "",
      };

      setUserInfo(user);
      localStorage.setItem("userInfo", JSON.stringify(user));
      navigate("/home");
    }}
    onError={() => console.log("Failed to login")}
    auto_select={true}
  />
)}


    <header className="d-flex flex-column align-items-center my-3">
  <img
    src={userInfo?.picture || User}
    height="60"
    width="60"
    className="d-inline-block text-center mx-1 me-2 rounded-circle"
    alt="User"
  />
  <h1 className="mt-2">{userInfo?.name || "USER NAME"}</h1>  
</header>


      <div className="alert alert-primary alert-dismissible fade show mx-5" role="alert">
  <strong>Wanna break from the ads?</strong> Feel free with <a href="#" className="alert-link">WalkifyPlus</a>. <br/> Just <strong>$2</strong>/month for clean look and no distraction.
  <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
      </div>

      <nav className="fs-3 mx-5">
        <hr />
        <div>
          <i className="bi bi-person-vcard mx-3"></i>
          Personal data</div>
        <hr />
        <div>
          <i className="bi bi-shield-lock mx-3"></i>
          Security</div>
        <hr />
        <div>
          <i className="bi bi-translate mx-3"></i>
          Language</div>
        <hr />
        <div>
          <i className="bi bi-envelope-paper mx-3"></i>
          Mailing settings</div>
        <hr />
        <div onClick={() => setShowExportModal(true)} role="button">
          <i className="bi bi-download mx-3"></i>
          Експортувати дані</div>
        <hr />
        <div onClick={() => setShowImportModal(true)} role="button">
          <i className="bi bi-upload mx-3"></i>
          Імпортувати дані</div>
        <hr />
        <div onClick={handleLogout} role="button">
          <i className="bi bi-box-arrow-right mx-3"></i>
          Exit</div>
        <hr />
        <div>
          <i className="bi bi-person-dash mx-3"></i>
          Delete account</div>
        <hr />
      </nav>

      {/* Модальне вікно експорту */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-download me-2"></i>
            Експортувати дані
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Експортувати всі ваші збережені маршрути та статистику для синхронізації між пристроями.</p>
          <p className="small text-muted">
            Після експорту збережіть файл у Google Drive, щоб мати доступ до нього на інших пристроях.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExportModal(false)}>
            Скасувати
          </Button>
          <Button variant="success" onClick={handleExportData}>
            <i className="bi bi-download me-2"></i>
            Експортувати
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Модальне вікно імпорту */}
      <Modal show={showImportModal} onHide={() => setShowImportModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-upload me-2"></i>
            Імпортувати дані
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Імпортувати збережені маршрути та статистику з іншого пристрою.</p>
          <div className="mb-3">
            <label className="form-label">Виберіть файл для імпорту:</label>
            <input
              type="file"
              className="form-control"
              accept=".json"
              onChange={handleFileImport}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Або вставте JSON дані вручну:</label>
            <textarea
              className="form-control"
              rows={8}
              value={importData}
              onChange={(e) => setImportData(e.target.value)}
              placeholder="Вставте JSON дані тут..."
            />
          </div>
          {importError && (
            <Alert variant="danger" className="mt-3">
              {importError}
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => {
            setShowImportModal(false);
            setImportData("");
            setImportError("");
          }}>
            Скасувати
          </Button>
          <Button 
            variant="success" 
            onClick={handleImportData}
            disabled={!importData.trim()}
          >
            <i className="bi bi-upload me-2"></i>
            Імпортувати
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  )
}

export default Profile;
