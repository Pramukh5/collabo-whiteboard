require('dotenv').config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const jwt = require("jsonwebtoken");

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files from React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../build')));
}

const server = require("http").createServer(app);
const io = require("socket.io")(server, {
  cors: { origin: "*" },
});

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || 'YOUR_SUPABASE_SERVICE_KEY';
const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET || 'YOUR_SUPABASE_JWT_SECRET';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Verify Supabase JWT token
const verifyToken = (token) => {
  try {
    if (!token) return null;
    const decoded = jwt.verify(token, supabaseJwtSecret);
    return decoded;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

// Store state per room
// rooms[roomId] = { canvasState: [], stickyNotes: [], users: {} }
const rooms = {};

// User colors palette
const userColors = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e', 
  '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

// Get a color for a user based on their socket id
const getUserColor = (socketId) => {
  const hash = socketId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return userColors[hash % userColors.length];
};

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  // For development, allow connections without token
  if (!token && process.env.NODE_ENV !== 'production') {
    socket.user = { id: socket.id, email: 'guest@local', isGuest: true };
    return next();
  }
  
  const decoded = verifyToken(token);
  if (!decoded) {
    return next(new Error('Authentication failed'));
  }
  
  socket.user = {
    id: decoded.sub,
    email: decoded.email,
    displayName: decoded.user_metadata?.display_name || decoded.user_metadata?.full_name || decoded.email?.split('@')[0],
    avatarUrl: decoded.user_metadata?.avatar_url || decoded.user_metadata?.picture,
  };
  
  next();
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id, socket.user?.email || 'guest');
  
  // Store user's room for cleanup on disconnect
  let currentRoom = null;
  const userName = socket.user?.displayName || socket.user?.email?.split('@')[0] || 'Anonymous';
  const userColor = getUserColor(socket.id);

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    currentRoom = roomId;
    console.log(`User ${socket.id} (${userName}) joined room ${roomId}`);

    if (!rooms[roomId]) {
      rooms[roomId] = { canvasState: [], stickyNotes: [], users: {} };
    }

    // Add user to room's user list
    rooms[roomId].users[socket.id] = { 
      userName, 
      userColor,
      odId: socket.user?.id,
      email: socket.user?.email,
      avatarUrl: socket.user?.avatarUrl
    };

    // Notify others in the room about new user
    socket.to(roomId).emit("user:joined", { 
      odId: socket.id, 
      userName, 
      userColor,
      odId: socket.user?.id,
      avatarUrl: socket.user?.avatarUrl
    });

    // Send current canvas state to newly connected client
    socket.emit("init", rooms[roomId].canvasState);

    // Send current sticky notes to newly connected client
    rooms[roomId].stickyNotes.forEach(note => {
      socket.emit("stickyNote:create", note);
    });

    // Send current users' cursors to the newly connected client
    // (they will receive cursor:move events as users move)
  });

  // Handle cursor movement
  socket.on("cursor:move", (data) => {
    const { roomId, x, y } = data;
    if (rooms[roomId] && rooms[roomId].users[socket.id]) {
      const { userName, userColor } = rooms[roomId].users[socket.id];
      socket.to(roomId).emit("cursor:move", { 
        odId: socket.id, 
        x, 
        y, 
        userName, 
        userColor 
      });
    }
  });

  // Handle cursor leave
  socket.on("cursor:leave", (data) => {
    const { roomId } = data;
    socket.to(roomId).emit("cursor:leave", { odId: socket.id });
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    if (currentRoom && rooms[currentRoom]) {
      // Remove user from room's user list
      delete rooms[currentRoom].users[socket.id];
      // Notify others in the room
      socket.to(currentRoom).emit("user:left", { odId: socket.id });
      socket.to(currentRoom).emit("cursor:leave", { odId: socket.id });
    }
  });

  socket.on("draw", (data) => {
    const { roomId, ...drawData } = data;
    // Ensure socketId is passed through
    socket.to(roomId).emit("draw", { ...drawData, socketId: socket.id });
  });

  socket.on("text", (data) => {
    const { roomId, ...textData } = data;
    if (rooms[roomId]) {
      rooms[roomId].canvasState.push(textData);
      socket.to(roomId).emit("text", textData);
    }
  });

  socket.on("stroke", (data) => {
    const { roomId, ...strokeData } = data;
    if (rooms[roomId]) {
      rooms[roomId].canvasState.push(strokeData);
      // Ensure socketId is passed through
      socket.to(roomId).emit("stroke", { ...strokeData, socketId: socket.id });
    }
  });

  socket.on("move", (data) => {
    const { roomId, ...moveData } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[moveData.index]) {
        const obj = canvasState[moveData.index];
        if (obj.type === 'stroke') {
          obj.points = obj.points.map(
            p => ({ x: p.x + moveData.deltaX, y: p.y + moveData.deltaY })
          );
        } else if (obj.type === 'text') {
          obj.x += moveData.deltaX;
          obj.y += moveData.deltaY;
        } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
          obj.x += moveData.deltaX;
          obj.y += moveData.deltaY;
        } else if (obj.type === 'line' || obj.type === 'arrow') {
          obj.x1 += moveData.deltaX;
          obj.y1 += moveData.deltaY;
          obj.x2 += moveData.deltaX;
          obj.y2 += moveData.deltaY;
        }
      }
      socket.to(roomId).emit("move", moveData);
    }
  });

  socket.on("resize", (data) => {
    const { roomId, ...resizeData } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[resizeData.index] && canvasState[resizeData.index].type === 'text') {
        canvasState[resizeData.index].fontSize = resizeData.fontSize;
      }
      socket.to(roomId).emit("resize", resizeData);
    }
  });

  socket.on("resizeStroke", (data) => {
    const { roomId, ...resizeData } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[resizeData.index] && canvasState[resizeData.index].type === 'stroke') {
        canvasState[resizeData.index].points = resizeData.points;
      }
      socket.to(roomId).emit("resizeStroke", resizeData);
    }
  });

  socket.on("shape", (data) => {
    const { roomId, ...shapeData } = data;
    if (rooms[roomId]) {
      rooms[roomId].canvasState.push(shapeData);
      socket.to(roomId).emit("shape", shapeData);
    }
  });

  socket.on("resizeShape", (data) => {
    const { roomId, ...resizeData } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[resizeData.index]) {
        const obj = canvasState[resizeData.index];
        if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
          obj.x = resizeData.x;
          obj.y = resizeData.y;
          obj.width = resizeData.width;
          obj.height = resizeData.height;
        }
      }
      socket.to(roomId).emit("resizeShape", resizeData);
    }
  });

  socket.on("resizeLine", (data) => {
    const { roomId, ...resizeData } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[resizeData.index]) {
        const obj = canvasState[resizeData.index];
        if (obj.type === 'line' || obj.type === 'arrow') {
          obj.x1 = resizeData.x1;
          obj.y1 = resizeData.y1;
          obj.x2 = resizeData.x2;
          obj.y2 = resizeData.y2;
        }
      }
      socket.to(roomId).emit("resizeLine", resizeData);
    }
  });

  socket.on("undo", (data) => {
    // Undo is tricky with shared state, currently just broadcasting
    // Ideally we should update server state to match
    // For now, we'll just broadcast to room
    const { roomId, ...undoData } = data;
    socket.to(roomId).emit("undo", undoData);
  });

  socket.on("redo", (data) => {
    const { roomId, ...redoData } = data;
    socket.to(roomId).emit("redo", redoData);
  });

  socket.on("clear", (roomId) => {
    if (rooms[roomId]) {
      rooms[roomId].canvasState = [];
      socket.to(roomId).emit("clear");
    }
  });

  socket.on("delete", (data) => {
    const { roomId, index } = data;
    if (rooms[roomId]) {
      const canvasState = rooms[roomId].canvasState;
      if (canvasState[index]) {
        canvasState[index].deleted = true;
      }
      socket.to(roomId).emit("delete", { index });
    }
  });

  socket.on("stickyNote:create", (data) => {
    const { roomId, ...note } = data;
    if (rooms[roomId]) {
      rooms[roomId].stickyNotes.push(note);
      socket.to(roomId).emit("stickyNote:create", note);
    }
  });

  socket.on("stickyNote:update", (data) => {
    const { roomId, ...updateData } = data;
    if (rooms[roomId]) {
      const note = rooms[roomId].stickyNotes.find(n => n.id === updateData.id);
      if (note) {
        note.text = updateData.text;
      }
      socket.to(roomId).emit("stickyNote:update", updateData);
    }
  });

  socket.on("stickyNote:move", (data) => {
    const { roomId, ...moveData } = data;
    if (rooms[roomId]) {
      const note = rooms[roomId].stickyNotes.find(n => n.id === moveData.id);
      if (note) {
        note.x = moveData.x;
        note.y = moveData.y;
      }
      socket.to(roomId).emit("stickyNote:move", moveData);
    }
  });

  socket.on("stickyNote:resize", (data) => {
    const { roomId, ...resizeData } = data;
    if (rooms[roomId]) {
      const note = rooms[roomId].stickyNotes.find(n => n.id === resizeData.id);
      if (note) {
        note.x = resizeData.x;
        note.y = resizeData.y;
        note.width = resizeData.width;
        note.height = resizeData.height;
      }
      socket.to(roomId).emit("stickyNote:resize", resizeData);
    }
  });

  socket.on("stickyNote:delete", (data) => {
    const { roomId, ...deleteData } = data;
    if (rooms[roomId]) {
      rooms[roomId].stickyNotes = rooms[roomId].stickyNotes.filter(n => n.id !== deleteData.id);
      socket.to(roomId).emit("stickyNote:delete", deleteData);
    }
  });
});

// Catch-all route for React SPA (must be after all other routes)
// Express 5 requires '{*path}' syntax instead of '*'
if (process.env.NODE_ENV === 'production') {
  app.get('{*path}', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
