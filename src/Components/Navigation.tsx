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
  Toast,
  ToastContainer,
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
  Link,
} from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  searchUsers,
  signOut,
  UserProfile as UserProfileType,
} from "../services/supabaseService";
import { supabase } from "../services/supabaseService";

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
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const [lastMessagePreview, setLastMessagePreview] = useState<string | null>(null);
  const [showMessageToast, setShowMessageToast] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const navigate = useNavigate();

  useEffect(() => {
    const storedUser = localStorage.getItem("userInfo");
    if (storedUser) {
      setUserInfo(JSON.parse(storedUser));
    }
  }, []);

  // Track browser notification permission
  useEffect(() => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setNotificationPermission("unsupported");
      return;
    }
    setNotificationPermission(Notification.permission);
  }, []);

  const handleEnableNotifications = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
    } catch (err) {
      console.error("Notification permission error:", err);
    }
  };

  // Global realtime subscription for incoming messages (for badge + toast)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("messages:global")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const msg = payload.new as { sender_id: string; content: string };
          // Ignore messages sent by the current user
          if (!user || msg.sender_id === user.id) return;

          setHasUnreadMessages(true);

          const preview =
            msg.content.length > 80
              ? msg.content.slice(0, 80) + "…"
              : msg.content;
          setLastMessagePreview(preview);
          setShowMessageToast(true);

          // Native browser notification (if allowed)
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            try {
              new Notification("New message", {
                body: msg.content,
              });
            } catch (err) {
              console.error("Error showing system notification:", err);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

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
      {/* In-app popup for latest message */}
      {lastMessagePreview && (
        <ToastContainer position="top-center" className="mt-5 pt-4">
          <Toast
            bg="light"
            onClose={() => setShowMessageToast(false)}
            show={showMessageToast}
            delay={5000}
            autohide
          >
            <Toast.Header closeButton>
              <strong className="me-auto">New message</strong>
            </Toast.Header>
            <Toast.Body>{lastMessagePreview}</Toast.Body>
          </Toast>
        </ToastContainer>
      )}

      <Navbar
        className="bg-success fixed-top"
        expand="true"
        variant="dark"
        style={{ height: "60px" }}
        collapseOnSelect
      >
        <Container>
          <Navbar.Brand as={Link} to="/home">
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
                      as={Link}
                      to={`/user/${profile?.id || user?.id}`}
                      className="m-0"
                      onClick={() => setIsMenuOpen(false)}
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
                <Nav.Link as={Link} to="/home" onClick={() => setIsMenuOpen(false)}>Home</Nav.Link>
                <hr></hr>
                <Nav.Link as={Link} to="/favs" onClick={() => setIsMenuOpen(false)}>Routes</Nav.Link>
                <hr></hr>
                <Nav.Link as={Link} to="/stat" onClick={() => setIsMenuOpen(false)}>Statistic</Nav.Link>
                <hr></hr>
                {user && (
                  <>
                    <Nav.Link
                      as={Link}
                      to="/chat"
                      onClick={() => {
                        setHasUnreadMessages(false);
                        setIsMenuOpen(false);
                      }}
                      className="d-flex align-items-center justify-content-between"
                    >
                      <span>Messages</span>
                      {hasUnreadMessages && (
                        <span className="badge bg-danger ms-2 rounded-pill">
                          ●
                        </span>
                      )}
                    </Nav.Link>
                    {notificationPermission === "default" && (
                      <Button
                        variant="outline-light"
                        size="sm"
                        className="mt-2 w-100"
                        onClick={handleEnableNotifications}
                      >
                        Allow device notifications
                      </Button>
                    )}
                    <hr></hr>
                  </>
                )}
                {user && (
                  <>
                    <Nav.Link as={Link} to="/profile" onClick={() => setIsMenuOpen(false)}>Profile</Nav.Link>
                    <hr></hr>
                    <Nav.Link
                      className="w-100"
                      style={{ cursor: "pointer" }}
                      onClick={async () => {
                        await signOut();
                        setIsMenuOpen(false);
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
                    <Nav.Link as={Link} to="/login" className="text-warning" onClick={() => setIsMenuOpen(false)}>
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
        <Button onClick={() => navigate("/home")} className="btn btn-success text-center rounded-0">
          <i className="bi bi-house"></i>
          <br />
          Home
        </Button>
        <Button onClick={() => navigate("/favs")} className="btn btn-success text-center">
          <i className="bi bi-geo-alt"></i>
          <br />
          Routes
        </Button>
        <Button onClick={() => navigate("/stat")} className="btn btn-success text-center">
          <i className="bi bi-graph-up"></i>
          <br />
          Statistic
        </Button>
        {user && (
          <Button
            onClick={() => {
              setHasUnreadMessages(false);
              navigate("/chat");
            }}
            className="btn btn-success text-center position-relative"
          >
            <i className="bi bi-chat-dots"></i>
            {hasUnreadMessages && (
              <span
                className="position-absolute top-0 end-0 translate-middle badge rounded-pill bg-danger"
                style={{ width: "10px", height: "10px", padding: 0 }}
              >
                {" "}
              </span>
            )}
            <br />
            Chat
          </Button>
        )}
        {user && (
          <Button onClick={() => navigate("/profile")} className="btn btn-success text-center rounded-0">
            <i className="bi bi-person"></i>
            <br />
            Profile
          </Button>
        )}
        {!user && (
          <Button onClick={() => navigate("/login")} className="btn btn-success text-center rounded-0">
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
