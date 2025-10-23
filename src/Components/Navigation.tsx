import { useState } from "react";
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
import Home from "../pages/Home";
import Favorites from "../pages/Favorites";
import Profile from "../pages/Profile";
import Statistic from "../pages/Statistic";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";

function Navigation() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <>
      <Navbar
        className="bg-success sticky-top"
        expand="true"
        variant="dark"
        style={{height: "60px"}}
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
          >
            <Offcanvas.Header className="bg-success text-bg-dark" closeButton>
              <Offcanvas.Title>Offcanvas</Offcanvas.Title>
            </Offcanvas.Header>
            <Offcanvas.Body className="bg-success text-bg-dark">
              <Nav className="mr-auto">
                <Nav.Link href="/home">Home</Nav.Link>
                <Nav.Link href="/favs">Favotites</Nav.Link>
                <Nav.Link href="/prof">Profile</Nav.Link>
                <Nav.Link href="/stat">Statistic</Nav.Link>
              </Nav>
              <Form className="hstack g-2">
                <input
                  type="text"
                  placeholder="Search"
                  className="form-control me-2"
                />
                <Button>Search</Button>
              </Form>
            </Offcanvas.Body>
          </Offcanvas>
        </Container>
      </Navbar>
      <ButtonGroup className="fixed-bottom" style={{height: "60px"}}>
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
        </Routes>
      </Router>
    </>
  );
}
export default Navigation;
