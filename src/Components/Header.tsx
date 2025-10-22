import {
  Navbar,
  Container,
  Button,
  Nav,
  Form
} from "react-bootstrap";
import logo from "../assets/images/icon.png";


function Header() {
  return (
    <>
      <Navbar
        className="bg-success rounded-bottom-3 fixed-top"
        expand="true"
        variant="dark"
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
          <Navbar.Toggle aria-controls="responsive-navbar-nav" />
          <Navbar.Collapse id="responsive-navbar-nav">
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
          </Navbar.Collapse>
        </Container>
      </Navbar>
    </>
  );
}
export default Header;
