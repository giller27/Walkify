import {
  Navbar,
  Container,
  FormControl,
  Button,
  Nav,
  Form,
} from "react-bootstrap";
import logo from "./icon.png";

function Header() {
  return (
    <Navbar className="bg-success" collapseOnSelect expand="sm" variant="dark">
      <Container>
        <Navbar.Brand href="/">
          <img
            src={logo}
            height="30"
            width="30"
            className="d-inline-block align-top"
            alt="Logo"
          />{" "}
          <text href="/">Walkify</text>
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="responsive-navbar-nav" />
        <Navbar.Collapse id="responsive-navbar-nav">
          <Nav className="mr-auto">
            <Nav.Link href="/">Home</Nav.Link>
            <Nav.Link href="/about">About us</Nav.Link>
            <Nav.Link href="/cont">Contacts</Nav.Link>
            <Nav.Link href="/blog">Blog</Nav.Link>
          </Nav>
          <Form className="hstack g-2">
            <input
              type="text"
              placeholder="Search"
              className="mr-sm-2 form-control"
            />
            <Button>Search</Button>
          </Form>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
export default Header;
