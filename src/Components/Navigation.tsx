import { useState, useEffect } from "react";
import {
  Navbar,
  Container,
  Button,
  Nav,
  Form,
  ButtonGroup,
  Offcanvas,
  Dropdown,
} from "react-bootstrap";
import logo from "../assets/images/icon.png";
import User from "../assets/images/user.png";
import Home from "../pages/Home";
import Favorites from "../pages/Favorites";
import Profile from "../pages/Profile";
import Statistic from "../pages/Statistic";
import Chat from "../pages/Chat";
import Login from "../pages/Login";
import ViewUserProfile from "../pages/ViewUserProfile";
import AuthCallback from "../pages/AuthCallback";
import {
  BrowserRouter as Router,
  Route,
  Routes,
  useNavigate,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  searchUsers,
  signOut,
  UserProfile as UserProfileType,
} from "../services/supabaseService";

interface GoogleUser {
  name: string;
  picture: string;
  email: string;
}

function NavigationContent() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserProfileType[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const { user, profile } = useAuth();
  const [userInfo, setUserInfo] = useState<GoogleUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      setUserInfo(JSON.parse(storedUser));
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await searchUsers(searchQuery);
      setSearchResults(results);
      setShowSearchResults(true);
    } catch (err) {
      console.error("Search error:", err);
      setSearchResults([]);
    }
  };

  const handleSelectUser = (userId: string) => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearchResults(false);
    setIsMenuOpen(false);
    navigate(`/user/${userId}`);
  };

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
                  src={profile?.avatar_url || userInfo?.picture || User}
                  height="40"
                  width="40"
                  className="d-inline-block text-center mx-1 me-2 rounded-circle"
                  alt="User"
                />
                <div>
                  <h1 className="fs-4 m-0">
                    {user
                      ? profile?.full_name ||
                        userInfo?.name ||
                        user?.email?.split("@")[0] ||
                        "User"
                      : "User"}
                  </h1>
                  {user ? (
                    <Nav.Link
                      href={`/user/${profile?.id || user?.id}`}
                      className="m-0"
                    >
                      {user?.email}
                    </Nav.Link>
                  ) : (
                    <Nav.Link href="/login" className="m-0">
                      <i className="bi bi-box-arrow-in-right me-1"></i>
                      Увійти
                    </Nav.Link>
                  )}
                </div>
              </div>

              <Form className="hstack g-2 py-3 px-4" onSubmit={handleSearch}>
                <input
                  type="text"
                  placeholder="Search users..."
                  className="form-control me-2"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <Button type="submit" variant="light">
                  Search
                </Button>
              </Form>

              {showSearchResults && searchResults.length > 0 && (
                <div className="px-4 py-2 bg-light rounded">
                  <p className="text-dark mb-2">Результати пошуку:</p>
                  {searchResults.map((result) => (
                    <div
                      key={result.id}
                      className="d-flex align-items-center gap-2 p-2 border rounded mb-2 bg-white"
                    >
                      <button
                        className="flex-grow-1 text-start border-0 bg-transparent"
                        style={{ cursor: "pointer", textDecoration: "none" }}
                        onClick={() => handleSelectUser(result.id)}
                      >
                        <div className="fw-bold text-dark">
                          {result.full_name || "Unknown User"}
                        </div>
                        <small className="text-muted">{result.email}</small>
                      </button>
                      {user && (
                        <Button
                          variant="success"
                          size="sm"
                          onClick={() => {
                            setShowSearchResults(false);
                            setSearchQuery("");
                            setSearchResults([]);
                            setIsMenuOpen(false);
                            navigate(`/chat?with=${result.id}`);
                          }}
                        >
                          <i className="bi bi-chat-dots"></i>
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <Nav className="px-4 mt-2">
                <hr></hr>
                <Nav.Link href="/home">Home</Nav.Link>
                <hr></hr>
                <Nav.Link href="/favs">Routes</Nav.Link>
                <hr></hr>
                <Nav.Link href="/stat">Statistic</Nav.Link>
                <hr></hr>
                {user && (
                  <>
                    <Nav.Link href="/chat">Messages</Nav.Link>
                    <hr></hr>
                  </>
                )}
                {user && (
                  <>
                    <Nav.Link href={`/profile`}>Profile</Nav.Link>
                    <hr></hr>
                    <Nav.Link
                      href="/login"
                      className="w-100"
                      onClick={async () => {
                        await signOut();
                        navigate("/login");
                      }}
                    >
                      <i className="bi bi-box-arrow-right me-2"></i>
                      Вихід
                    </Nav.Link>
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
          <i className="bi bi-geo-alt"></i>
          <br />
          Routes
        </Button>
        <Button className="btn btn-success text-center" href="/stat">
          <i className="bi bi-graph-up"></i>
          <br />
          Statistic
        </Button>
        {user && (
          <Button className="btn btn-success text-center" href="/chat">
            <i className="bi bi-chat-dots"></i>
            <br />
            Chat
          </Button>
        )}
        {user && (
          <Button
            className="btn btn-success text-center rounded-0"
            href={`/profile`}
          >
            <i className="bi bi-person"></i>
            <br />
            Profile
          </Button>
        )}
        {!user && (
          <Button
            className="btn btn-success text-center rounded-0"
            href="/login"
          >
            <i className="bi bi-box-arrow-in-right"></i>
            <br />
            Login
          </Button>
        )}
      </ButtonGroup>
    </>
  );
}

function Navigation() {
  return (
    <Router>
      <NavigationContent />
      <Routes>
        <Route path="/" Component={Home} />
        <Route path="/home" Component={Home} />
        <Route path="/profile" Component={Profile} />
        <Route path="/favs" Component={Favorites} />
        <Route path="/stat" Component={Statistic} />
        <Route path="/chat" Component={Chat} />
        <Route path="/chat/:conversationId" Component={Chat} />
        <Route path="/login" Component={Login} />
        <Route path="/user/:id" Component={ViewUserProfile} />
        <Route path="/auth/callback" Component={AuthCallback} />
      </Routes>
    </Router>
  );
}

export default Navigation;
