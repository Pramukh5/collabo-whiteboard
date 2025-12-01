import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Whiteboard from './Whiteboard';

// Create a proper mock canvas context
const createMockContext = () => ({
  lineJoin: 'round',
  lineCap: 'round',
  strokeStyle: '#000000',
  lineWidth: 4,
  globalCompositeOperation: 'source-over',
  fillStyle: '#000000',
  font: '16px sans-serif',
  textBaseline: 'top',
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  closePath: jest.fn(),
  fillText: jest.fn(),
  clearRect: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  scale: jest.fn(),
  translate: jest.fn(),
  setTransform: jest.fn(),
  setLineDash: jest.fn(),
  rect: jest.fn(),
  ellipse: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  drawImage: jest.fn(),
  getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
  putImageData: jest.fn(),
  createLinearGradient: jest.fn(() => ({ addColorStop: jest.fn() })),
  measureText: jest.fn(() => ({ width: 100 })),
});

// Setup canvas mocks before tests
let mockCtx;
beforeAll(() => {
  mockCtx = createMockContext();
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockImageData');
  HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
    left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080,
  }));
});

// Mock socket factory
const createMockSocket = () => ({
  on: jest.fn(),
  emit: jest.fn(),
  off: jest.fn(),
  disconnect: jest.fn(),
});

describe('Whiteboard Component', () => {
  let mockSocket;

  beforeEach(() => {
    mockSocket = createMockSocket();
    jest.clearAllMocks();
    mockCtx = createMockContext();
    HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  });

  describe('Initialization', () => {
    test('renders canvas element', () => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );
      
      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });

    test('initializes canvas context', () => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#ff0000" 
          size={8} 
          tool="pen" 
        />
      );
      
      expect(HTMLCanvasElement.prototype.getContext).toHaveBeenCalledWith('2d');
    });

    test('sets up socket event listeners', () => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );
      
      expect(mockSocket.on).toHaveBeenCalled();
    });
  });

  describe('Drawing Tools', () => {
    test('pen tool responds to mouse events', () => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );

      const canvas = document.querySelector('canvas');
      
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      fireEvent.mouseUp(canvas);
      
      expect(canvas).toBeInTheDocument();
    });

    test('socket emits events on draw', () => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#ff0000" 
          size={6} 
          tool="pen" 
        />
      );

      const canvas = document.querySelector('canvas');
      
      fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100, button: 0 });
      fireEvent.mouseMove(canvas, { clientX: 150, clientY: 150 });
      
      expect(mockSocket.emit).toHaveBeenCalled();
    });
  });

  describe('Tool Switching', () => {
    test.each([
      ['erase'],
      ['text'],
      ['select'],
      ['pan'],
      ['rectangle'],
      ['ellipse'],
      ['line'],
      ['stickyNote'],
    ])('renders with %s tool', (tool) => {
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool={tool} 
        />
      );

      const canvas = document.querySelector('canvas');
      expect(canvas).toBeInTheDocument();
    });
  });

  describe('Ref Methods', () => {
    test('exposes undo method via ref', () => {
      const ref = { current: null };
      
      render(
        <Whiteboard 
          ref={ref}
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );

      expect(ref.current).toHaveProperty('undo');
      expect(typeof ref.current.undo).toBe('function');
    });

    test('exposes redo method via ref', () => {
      const ref = { current: null };
      
      render(
        <Whiteboard 
          ref={ref}
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );

      expect(ref.current).toHaveProperty('redo');
      expect(typeof ref.current.redo).toBe('function');
    });

    test('undo method can be called', () => {
      const ref = { current: null };
      
      render(
        <Whiteboard 
          ref={ref}
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );

      expect(() => ref.current.undo()).not.toThrow();
    });

    test('redo method can be called', () => {
      const ref = { current: null };
      
      render(
        <Whiteboard 
          ref={ref}
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen" 
        />
      );

      expect(() => ref.current.redo()).not.toThrow();
    });
  });

  describe('Props', () => {
    test('accepts onZoomChange prop', () => {
      const onZoomChange = jest.fn();
      
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen"
          onZoomChange={onZoomChange}
        />
      );

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    test('accepts remoteCursors prop', () => {
      const remoteCursors = {
        'user-1': { x: 200, y: 200, userName: 'Alice', userColor: '#ff0000' },
      };

      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen"
          remoteCursors={remoteCursors}
        />
      );

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    test('accepts onSceneChange prop', () => {
      const onSceneChange = jest.fn();
      
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen"
          onSceneChange={onSceneChange}
        />
      );

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });

    test('accepts initialScene prop', () => {
      const initialScene = {
        objects: [],
        stickyNotes: [],
      };
      
      render(
        <Whiteboard 
          socket={mockSocket} 
          roomId="test-room" 
          color="#000000" 
          size={4} 
          tool="pen"
          initialScene={initialScene}
        />
      );

      expect(document.querySelector('canvas')).toBeInTheDocument();
    });
  });
});
