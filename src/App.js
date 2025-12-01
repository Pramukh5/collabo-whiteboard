import io from 'socket.io-client';
import Whiteboard from './components/Whiteboard';
import Toolbar from './components/Toolbar';
import { useState, useRef, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, useParams, useNavigate, Navigate } from 'react-router-dom';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Dashboard from './components/Dashboard/Dashboard';
import UserProfile from './components/UserProfile/UserProfile';
import { AcceptInvite } from './components/Collaboration';
import { getBoard, saveBoardScene } from './supabase';
import { usePresence } from './hooks/usePresence';

import './App.css';

// Create socket connection with auth token
const getSocketUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const createSocket = (accessToken) => {
  return io(getSocketUrl(), {
    auth: {
      token: accessToken
    }
  });
};

// Protected Route component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
}

// Public Route (redirect to dashboard if authenticated)
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-spinner" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
}

function Board() {
  const { boardId } = useParams();
  const { user, accessToken, getDisplayName, getAvatarUrl } = useAuth();
  const [color, setColor] = useState('#000');
  const [size, setSize] = useState(4);
  const [tool, setTool] = useState('pen');
  const [zoom, setZoom] = useState(1);
  const [socket, setSocket] = useState(null);
  const [boardData, setBoardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState(null); // null, 'saving', 'saved', 'error'
  const saveStatusTimeoutRef = useRef(null);
  const navigate = useNavigate();

  const whiteboardRef = useRef(null);

  // Supabase Presence for real-time cursor tracking
  const { onlineUsers, remoteCursors, updateCursor, leaveCursor } = usePresence(
    boardId,
    user,
    getDisplayName,
    getAvatarUrl
  );

  // Load board data
  useEffect(() => {
    const loadBoard = async () => {
      const { data, error } = await getBoard(boardId);
      if (error || !data) {
        navigate('/dashboard');
        return;
      }
      setBoardData(data);
      setLoading(false);
    };
    
    loadBoard();
  }, [boardId, navigate]);

  // Create socket connection
  useEffect(() => {
    if (!accessToken) return;
    
    const newSocket = createSocket(accessToken);
    setSocket(newSocket);
    
    return () => {
      newSocket.close();
    };
  }, [accessToken]);

  // Join room when socket and board are ready
  useEffect(() => {
    if (socket && boardData) {
      socket.emit("join-room", boardId);
    }
  }, [socket, boardData, boardId]);

  // Auto-save board scene
  const handleSceneChange = async (sceneData) => {
    if (boardData) {
      // Clear any existing timeout
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
      
      setSaveStatus('saving');
      const { error } = await saveBoardScene(boardId, sceneData);
      if (error) {
        console.error('Failed to save board:', error);
        setSaveStatus('error');
        // Hide error after 3 seconds
        saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(null), 3000);
      } else {
        console.log('Board saved successfully');
        setSaveStatus('saved');
        // Hide saved status after 2 seconds
        saveStatusTimeoutRef.current = setTimeout(() => setSaveStatus(null), 2000);
      }
    }
  };

  const handleUndo = () => {
    if (whiteboardRef.current) {
      whiteboardRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (whiteboardRef.current) {
      whiteboardRef.current.redo();
    }
  };

  const handleDelete = () => {
    if (whiteboardRef.current) {
      whiteboardRef.current.deleteSelectedObject();
    }
  };

  if (loading) {
    return (
      <div className="home-container">
        <div className="loading-spinner" />
        <p className="home-subtitle">Loading board...</p>
      </div>
    );
  }

  if (!socket) {
    return (
      <div className="home-container">
        <div className="loading-spinner" />
        <p className="home-subtitle">Connecting...</p>
      </div>
    );
  }

  return (
    <>
      <Toolbar
        setColor={setColor}
        setSize={setSize}
        setTool={setTool}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onDelete={handleDelete}
        zoom={zoom}
        activeTool={tool}
      />
      
      <div className="user-profile-container">
        <UserProfile />
      </div>
      {/* Save Status Indicator */}
      {saveStatus && (
        <div className="save-status" style={{
          position: 'fixed',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '6px 16px',
          borderRadius: '20px',
          fontSize: '13px',
          fontWeight: '500',
          zIndex: 1000,
          background: saveStatus === 'saving' ? '#fef3c7' : 
                     saveStatus === 'error' ? '#fee2e2' : '#d1fae5',
          color: saveStatus === 'saving' ? '#92400e' : 
                 saveStatus === 'error' ? '#dc2626' : '#065f46',
          animation: 'fadeIn 0.2s ease',
        }}>
          {saveStatus === 'saving' && '💾 Saving...'}
          {saveStatus === 'saved' && '✓ Saved'}
          {saveStatus === 'error' && '⚠ Save failed'}
        </div>
      )}
      
      {/* Online Users Indicator */}
      {Object.keys(onlineUsers).length > 0 && (
        <div style={{
          position: 'fixed',
          top: '12px',
          right: '80px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.95)',
          borderRadius: '20px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: '#22c55e',
            animation: 'pulse 2s infinite',
          }} />
          <span style={{ fontSize: '13px', fontWeight: '500', color: '#374151' }}>
            {Object.keys(onlineUsers).length} online
          </span>
          <div style={{ display: 'flex', marginLeft: '4px' }}>
            {Object.values(onlineUsers).slice(0, 3).map((user, i) => (
              <div
                key={user.odId || i}
                title={user.userName}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: user.userColor || '#6366f1',
                  border: '2px solid white',
                  marginLeft: i > 0 ? '-8px' : '0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  fontWeight: '600',
                  color: 'white',
                  cursor: 'default',
                }}
              >
                {user.userName?.charAt(0).toUpperCase() || '?'}
              </div>
            ))}
            {Object.keys(onlineUsers).length > 3 && (
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: '#9ca3af',
                border: '2px solid white',
                marginLeft: '-8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                fontWeight: '600',
                color: 'white',
              }}>
                +{Object.keys(onlineUsers).length - 3}
              </div>
            )}
          </div>
        </div>
      )}
      
      <Whiteboard
        ref={whiteboardRef}
        socket={socket}
        roomId={boardId}
        color={color}
        size={size}
        tool={tool}
        onZoomChange={setZoom}
        initialScene={boardData?.scene_json ? JSON.parse(boardData.scene_json) : null}
        onSceneChange={handleSceneChange}
        userName={getDisplayName()}
        // Supabase Presence props
        remoteCursors={remoteCursors}
        onlineUsers={onlineUsers}
        onCursorMove={updateCursor}
        onCursorLeave={leaveCursor}
      />
    </>
  );
}

function Home() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (isAuthenticated) {
        navigate('/dashboard');
      } else {
        navigate('/login');
      }
    }
  }, [isAuthenticated, loading, navigate]);

  return (
    <div className="home-container">
      <h1 className="home-title">Collabo Whiteboard</h1>
      <p className="home-subtitle">Loading...</p>
      <div className="loading-spinner"></div>
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/board/:boardId"
        element={
          <ProtectedRoute>
            <Board />
          </ProtectedRoute>
        }
      />
      {/* Invite acceptance route - accessible without auth initially */}
      <Route path="/invite/:token" element={<AcceptInvite />} />
      {/* Legacy route redirect */}
      <Route path="/room/:roomId" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
