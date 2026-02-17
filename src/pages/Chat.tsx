import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  ListGroup,
  Form,
  Button,
  Spinner,
  Alert,
} from "react-bootstrap";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getUserProfile } from "../services/supabaseService";
import {
  getConversations,
  getOrCreateConversation,
  getMessages,
  sendMessage,
  subscribeToMessages,
  unsubscribeFromChannel,
  type ConversationWithOtherUser,
  type Message,
} from "../services/chatService";
import { RealtimeChannel } from "@supabase/supabase-js";
import userAvatar from "../assets/images/user.png";

function Chat() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { conversationId: routeConvId } = useParams<{ conversationId?: string }>();
  const [searchParams] = useSearchParams();
  const withUserId = searchParams.get("with");

  const [conversations, setConversations] = useState<ConversationWithOtherUser[]>([]);
  const [activeConversation, setActiveConversation] = useState<ConversationWithOtherUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Track browser notification permission for this page (UI hint)
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

  // Load conversations
  const loadConversations = useCallback(async (): Promise<ConversationWithOtherUser[]> => {
    if (!user) return [];
    try {
      const convs = await getConversations();
      setConversations(convs);
      return convs;
    } catch (err: any) {
      setError(err.message || "Failed to load conversations");
      return [];
    }
  }, [user]);

  // Load or create conversation when route/query changes
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      navigate("/login");
      return;
    }

    const init = async () => {
      setLoading(true);
      setError(null);

      try {
        const convs = await loadConversations();

        // Start new chat with user
        if (withUserId) {
          const conv = await getOrCreateConversation(withUserId);
          const otherProfile = await getUserProfile(withUserId);
          setActiveConversation({
            ...conv,
            other_user: otherProfile || undefined,
          });
          const refreshed = await loadConversations();
          setConversations(refreshed);
          navigate(`/chat/${conv.id}`, { replace: true });
        } else if (routeConvId) {
          const matched = convs.find((c) => c.id === routeConvId);
          setActiveConversation(matched || null);
        } else {
          setActiveConversation(null);
        }
      } catch (err: any) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [user, authLoading, routeConvId, withUserId, loadConversations]);

  // When active conversation changes, load messages and subscribe
  useEffect(() => {
    if (!activeConversation) {
      setMessages([]);
      return;
    }

    let mounted = true;

    const setup = async () => {
      try {
        const msgs = await getMessages(activeConversation.id);
        if (mounted) setMessages(msgs);
      } catch (err: any) {
        if (mounted) setError(err.message || "Failed to load messages");
      }

      // Subscribe to new messages
      const channel = subscribeToMessages(activeConversation.id, (msg) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      });
      channelRef.current = channel;
    };

    setup();

    return () => {
      mounted = false;
      if (channelRef.current) {
        unsubscribeFromChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSelectConversation = (conv: ConversationWithOtherUser) => {
    setActiveConversation(conv);
    navigate(`/chat/${conv.id}`);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !newMessage.trim() || sending) return;

    setSending(true);
    try {
      const msg = await sendMessage(activeConversation.id, newMessage);
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
      scrollToBottom();
      // Refresh conversation list to update last message
      await loadConversations();
    } catch (err: any) {
      setError(err.message || "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const formatLastMessage = (msg?: Message | null) => {
    if (!msg) return "No messages yet";
    const preview = msg.content.length > 50 ? msg.content.slice(0, 50) + "…" : msg.content;
    return preview;
  };

  if (authLoading) {
    return (
      <Container className="mt-5 pt-5 text-center">
        <Spinner animation="border" variant="success" />
        <p className="mt-3">Loading...</p>
      </Container>
    );
  }
  if (!user) {
    return (
      <Container className="mt-5 pt-5 text-center">
        <Alert variant="warning">Please log in to use chat.</Alert>
        <Button variant="success" onClick={() => navigate("/login")}>
          Log in
        </Button>
      </Container>
    );
  }

  return (
    <Container fluid className="chat-container mt-5 pt-4 pb-5">
      <Row className="g-0 h-100" style={{ minHeight: "calc(100vh - 180px)" }}>
        {/* Conversation list */}
        <Col
          xs={12}
          md={4}
          lg={3}
          className="border-end bg-light"
          style={{ maxHeight: "calc(100vh - 180px)", overflowY: "auto" }}
        >
          <div className="p-3 border-bottom bg-white">
            <h5 className="mb-0">
              <i className="bi bi-chat-dots me-2"></i>
              Messages
            </h5>
          </div>

          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="success" />
              <p className="mt-2 text-muted">Loading conversations...</p>
            </div>
          ) : error ? (
            <Alert variant="danger" className="m-3">
              {error}
            </Alert>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-muted">
              <i className="bi bi-chat fs-1"></i>
              <p className="mt-2 mb-0">No conversations yet</p>
              <small>Search for users and start a chat from their profile</small>
            </div>
          ) : (
            <ListGroup variant="flush">
              {conversations.map((conv) => {
                const isActive = activeConversation?.id === conv.id;
                return (
                  <ListGroup.Item
                    key={conv.id}
                    action
                    active={isActive}
                    onClick={() => handleSelectConversation(conv)}
                    className="d-flex align-items-center py-3 border-0 border-bottom rounded-0"
                    style={{ cursor: "pointer" }}
                  >
                    <img
                      src={conv.other_user?.avatar_url || userAvatar}
                      alt=""
                      className="rounded-circle me-3"
                      style={{ width: 48, height: 48, objectFit: "cover" }}
                    />
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="d-flex justify-content-between align-items-start">
                        <span className="fw-semibold text-truncate">
                          {conv.other_user?.full_name || "Unknown"}
                        </span>
                        {conv.last_message && (
                          <small className="text-muted ms-2 flex-shrink-0">
                            {formatTime(conv.last_message.created_at)}
                          </small>
                        )}
                      </div>
                      <small className="text-muted text-truncate d-block">
                        {formatLastMessage(conv.last_message)}
                      </small>
                    </div>
                  </ListGroup.Item>
                );
              })}
            </ListGroup>
          )}
        </Col>

        {/* Chat area */}
        <Col xs={12} md={8} lg={9} className="d-flex flex-column bg-white">
          {activeConversation ? (
            <>
              {/* Chat header */}
              <div className="p-3 border-bottom d-flex align-items-center">
                <img
                  src={activeConversation.other_user?.avatar_url || userAvatar}
                  alt=""
                  className="rounded-circle me-2"
                  style={{ width: 40, height: 40, objectFit: "cover" }}
                />
                <div className="flex-grow-1">
                  <h5 className="mb-0">
                    {activeConversation.other_user?.full_name || "Unknown"}
                  </h5>
                </div>
                {notificationPermission === "default" && (
                  <Button
                    variant="outline-success"
                    size="sm"
                    onClick={handleEnableNotifications}
                  >
                    Enable notifications
                  </Button>
                )}
              </div>

              {/* Messages */}
              <div
                className="flex-grow-1 overflow-auto p-3"
                style={{ maxHeight: "400px" }}
              >
                {messages.map((msg) => {
                  const isOwn = msg.sender_id === user.id;
                  return (
                    <div
                      key={msg.id}
                      className={`d-flex mb-3 ${isOwn ? "justify-content-end" : "justify-content-start"}`}
                    >
                      <div
                        className={`rounded-3 px-3 py-2 shadow-sm ${
                          isOwn
                            ? "bg-success text-white"
                            : "bg-light text-dark"
                        }`}
                        style={{ maxWidth: "75%" }}
                      >
                        {!isOwn && (
                          <small className="d-block text-muted mb-1">
                            {msg.sender_profile?.full_name || "User"}
                          </small>
                        )}
                        <span style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {msg.content}
                        </span>
                        <small
                          className={`d-block mt-1 ${
                            isOwn ? "text-white-50" : "text-muted"
                          }`}
                        >
                          {formatTime(msg.created_at)}
                        </small>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <Form onSubmit={handleSend} className="p-3 border-top">
                <div className="d-flex gap-2">
                  <Form.Control
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    variant="success"
                    disabled={sending || !newMessage.trim()}
                  >
                    {sending ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="bi bi-send"></i>
                    )}
                  </Button>
                </div>
              </Form>
            </>
          ) : (
            <div className="flex-grow-1 d-flex align-items-center justify-content-center text-muted">
              <div className="text-center">
                <i className="bi bi-chat-left-text display-1"></i>
                <p className="mt-3 mb-0">Select a conversation or start a new chat</p>
                <small>Search for users and click "Message" on their profile</small>
              </div>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default Chat;
