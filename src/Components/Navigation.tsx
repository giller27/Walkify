import { useState, useEffect } from "react";
import {
  Navbar,
  Container,
  Button,
  Nav,
  Form,
  ButtonGroup,
  Offcanvas,
} from "react-bootstrap";
import logo from "../assets/images/icon.png";
import User from "../assets/images/user.png";
import Home from "../pages/Home";
import Favorites from "../pages/Favorites";
import Profile from "../pages/Profile";
import Statistic from "../pages/Statistic";
import Login from "../pages/Login";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user } = useAuth();
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);

  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      setUserInfo(JSON.parse(storedUser));
    }
  }, []);

  return (
    <>
      <Navbar
        className="bg-success fixed-top"
        expand="true"
        variant="dark"
        style={{ height: "60px" }}
        collapseOnSelect
      >
        <Container>
          <Navbar.Brand href="/home">
            <img
              src={logo}
              height="30"
              width="30"
              className="d-inline-block align-top"
              alt="Logo"
            />{" "}
            <text href="/home">Walkify</text>
          </Navbar.Brand>
          <Navbar.Toggle
            aria-controls="offcanvas-navbar-nav"
            onClick={() => setIsMenuOpen(true)}
          />

          <Offcanvas
            show={isMenuOpen}
            onHide={() => setIsMenuOpen(false)}
            placement="end"
            id="offcanvas-navbar-nav"
            backdropClassName="bg-success static"
          >
            <Offcanvas.Header className="bg-success text-bg-dark" closeButton>
              <Offcanvas.Title>
                <img
                  src={logo}
                  height="30"
                  width="30"
                  className="d-inline-block align-top"
                  alt="Logo"
                />{" "}
                Walkify
              </Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="bg-success text-bg-dark p-0">
              <div className="d-flex m-2 mx-4 align-items-center">
                <img
                  src={userInfo?.picture || User}
                  height="40"
                  width="40"
                  className="d-inline-block text-center mx-1 me-2 rounded-circle"
                  alt="User"
                />
                <div>
                  <h1 className="fs-4 m-0">
                    {user ? userInfo?.name || user?.email || "User" : "User"}
                  </h1>
                  {user ? (
                    <Nav.Link href="/prof" className="m-0">
                      User-Profile
                    </Nav.Link>
                  ) : (
                    <Nav.Link href="/login" className="m-0">
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      Увійти
                    </Nav.Link>
                  )}
                </div>
              </div>

              <Form className="hstack g-2 py-3 px-4">
                <input
                  type="text"
                  placeholder="Search"
                  className="form-control me-2"
                />
                <Button>Search</Button>
              </Form>

              <Nav className="px-4 mt-2">
                <hr></hr>
                <Nav.Link href="/home">Home</Nav.Link>
                <hr></hr>
                <Nav.Link href="/favs">Favorites</Nav.Link>
                <hr></hr>
                <Nav.Link href="/stat">Statistic</Nav.Link>
                <hr></hr>
                {user && (
                  <>
                    <Nav.Link href="/prof">Profile</Nav.Link>
                    <hr></hr>
                  </>
                )}
                {!user && (
                  <>
                    <Nav.Link href="/login" className="text-warning">
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      Увійти
                    </Nav.Link>
                    <hr></hr>
                  </>
                )}
              </Nav>
            </Offcanvas.Body>
          </Offcanvas>
        </Container>
      </Navbar>
      <ButtonGroup className="fixed-bottom" style={{ height: "60px" }}>
        <Button className="btn btn-success text-center rounded-0" href="/home">
          <i className="bi bi-house"></i>
          <br />
          Home
        </Button>
        <Button className="btn btn-success text-center" href="/favs">
          <i className="bi bi-heart"></i>
          <br />
          Favorites
        </Button>
        <Button className="btn btn-success text-center" href="/stat">
          <i className="bi bi-graph-up"></i>
          <br />
          Statistic
        </Button>
        <Button className="btn btn-success text-center rounded-0" href="/prof">
          <i className="bi bi-person"></i>
          <br />
          Profile
        </Button>
      </ButtonGroup>
      <Router>
        <Routes>
          <Route path="/" Component={Home} />
          <Route path="/home" Component={Home} />
          <Route path="/favs" Component={Favorites} />
          <Route path="/prof" Component={Profile} />
          <Route path="/stat" Component={Statistic} />
          <Route path="/login" Component={Login} />
        </Routes>
      </Router>
    </>
  );
}
export default Navigation;
