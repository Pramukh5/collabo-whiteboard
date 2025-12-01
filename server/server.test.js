/**
 * Server Integration Tests
 * 
 * These tests verify the Socket.IO server functionality.
 * Run with: cd server && npm test
 */

const http = require('http');
const { Server } = require('socket.io');
const Client = require('socket.io-client');

describe('Socket.IO Server', () => {
  let io, serverSocket, clientSocket, httpServer;
  const PORT = 5001; // Use different port for tests

  beforeAll((done) => {
    httpServer = http.createServer();
    io = new Server(httpServer, {
      cors: { origin: '*' },
    });
    
    httpServer.listen(PORT, () => {
      done();
    });
  });

  afterAll((done) => {
    io.close();
    httpServer.close(done);
  });

  beforeEach((done) => {
    // Create client socket
    clientSocket = Client(`http://localhost:${PORT}`, {
      auth: { token: null }, // Guest mode for tests
    });
    
    io.on('connection', (socket) => {
      serverSocket = socket;
    });
    
    clientSocket.on('connect', done);
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    test('client can connect to server', () => {
      expect(clientSocket.connected).toBe(true);
    });

    test('server receives connection event', () => {
      expect(serverSocket).toBeDefined();
    });
  });

  describe('Room Management', () => {
    test('client can join a room', (done) => {
      const roomId = 'test-room-123';
      
      clientSocket.emit('join-room', roomId);
      
      // Server should add client to room
      setTimeout(() => {
        const rooms = io.sockets.adapter.rooms;
        expect(rooms.has(roomId)).toBe(true);
        done();
      }, 100);
    });

    test('server sends init data on room join', (done) => {
      const roomId = 'test-room-456';
      
      clientSocket.on('init', (data) => {
        expect(Array.isArray(data)).toBe(true);
        done();
      });
      
      clientSocket.emit('join-room', roomId);
    });
  });

  describe('Drawing Events', () => {
    test('draw event is broadcasted to other clients', (done) => {
      const roomId = 'draw-test-room';
      
      // Create second client
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        // Both join the same room
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          // Listen for draw event on client2
          clientSocket2.on('draw', (data) => {
            expect(data.x).toBe(100);
            expect(data.y).toBe(150);
            clientSocket2.disconnect();
            done();
          });
          
          // Emit draw from client1
          clientSocket.emit('draw', {
            roomId,
            x: 100,
            y: 150,
            color: '#ff0000',
            size: 4,
            tool: 'pen',
          });
        }, 100);
      });
    });

    test('stroke event is broadcasted to other clients', (done) => {
      const roomId = 'stroke-test-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('stroke', (data) => {
            expect(data.points).toEqual([{ x: 10, y: 10 }, { x: 20, y: 20 }]);
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('stroke', {
            roomId,
            points: [{ x: 10, y: 10 }, { x: 20, y: 20 }],
            color: '#000000',
            size: 2,
            tool: 'pen',
          });
        }, 100);
      });
    });
  });

  describe('Cursor Events', () => {
    test('cursor:move is broadcasted to other clients', (done) => {
      const roomId = 'cursor-test-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('cursor:move', (data) => {
            expect(data.x).toBe(200);
            expect(data.y).toBe(300);
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('cursor:move', {
            roomId,
            x: 200,
            y: 300,
          });
        }, 100);
      });
    });

    test('cursor:leave is broadcasted on disconnect', (done) => {
      const roomId = 'cursor-leave-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('cursor:leave', (data) => {
            expect(data.odId).toBeDefined();
            clientSocket2.disconnect();
            done();
          });
          
          // Disconnect client1
          clientSocket.disconnect();
        }, 100);
      });
    });
  });

  describe('Sticky Notes', () => {
    test('stickyNote:create is broadcasted', (done) => {
      const roomId = 'sticky-test-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('stickyNote:create', (data) => {
            expect(data.id).toBe('note-123');
            expect(data.content).toBe('Test note');
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('stickyNote:create', {
            roomId,
            id: 'note-123',
            x: 100,
            y: 100,
            width: 200,
            height: 200,
            content: 'Test note',
            color: '#fff740',
          });
        }, 100);
      });
    });

    test('stickyNote:update is broadcasted', (done) => {
      const roomId = 'sticky-update-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('stickyNote:update', (data) => {
            expect(data.id).toBe('note-456');
            expect(data.content).toBe('Updated content');
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('stickyNote:update', {
            roomId,
            id: 'note-456',
            content: 'Updated content',
          });
        }, 100);
      });
    });

    test('stickyNote:delete is broadcasted', (done) => {
      const roomId = 'sticky-delete-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('stickyNote:delete', (data) => {
            expect(data.id).toBe('note-789');
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('stickyNote:delete', {
            roomId,
            id: 'note-789',
          });
        }, 100);
      });
    });
  });

  describe('Undo/Redo', () => {
    test('undo event is broadcasted', (done) => {
      const roomId = 'undo-test-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('undo', (data) => {
            expect(data.imageData).toBe('data:image/png;base64,mockImage');
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('undo', {
            roomId,
            imageData: 'data:image/png;base64,mockImage',
          });
        }, 100);
      });
    });

    test('redo event is broadcasted', (done) => {
      const roomId = 'redo-test-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket2.on('redo', (data) => {
            expect(data.imageData).toBe('data:image/png;base64,redoImage');
            clientSocket2.disconnect();
            done();
          });
          
          clientSocket.emit('redo', {
            roomId,
            imageData: 'data:image/png;base64,redoImage',
          });
        }, 100);
      });
    });
  });

  describe('User Events', () => {
    test('user:joined is broadcasted when user joins', (done) => {
      const roomId = 'user-join-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      // First client joins and listens
      clientSocket.emit('join-room', roomId);
      
      clientSocket.on('user:joined', (data) => {
        expect(data.userName).toBeDefined();
        clientSocket2.disconnect();
        done();
      });
      
      // Second client joins
      setTimeout(() => {
        clientSocket2.on('connect', () => {
          clientSocket2.emit('join-room', roomId);
        });
      }, 100);
    });

    test('user:left is broadcasted when user leaves', (done) => {
      const roomId = 'user-leave-room';
      
      const clientSocket2 = Client(`http://localhost:${PORT}`, {
        auth: { token: null },
      });
      
      clientSocket2.on('connect', () => {
        clientSocket.emit('join-room', roomId);
        clientSocket2.emit('join-room', roomId);
        
        setTimeout(() => {
          clientSocket.on('user:left', (data) => {
            expect(data.odId).toBeDefined();
            done();
          });
          
          clientSocket2.disconnect();
        }, 100);
      });
    });
  });
});

describe('Server API Endpoints', () => {
  // If you add REST API endpoints, test them here
  
  test('placeholder for API tests', () => {
    expect(true).toBe(true);
  });
});
