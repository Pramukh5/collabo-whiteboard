import { render, screen, waitFor } from '@testing-library/react';

// Mock socket.io-client
jest.mock('socket.io-client', () => {
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    off: jest.fn(),
    disconnect: jest.fn(),
    connect: jest.fn(),
    connected: true,
  };
  return jest.fn(() => mockSocket);
});

// Mock supabase
jest.mock('./supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ 
        data: { subscription: { unsubscribe: jest.fn() } } 
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
  signIn: jest.fn(),
  signUp: jest.fn(),
  signOut: jest.fn(),
  getBoards: jest.fn().mockResolvedValue({ data: [], error: null }),
  getBoard: jest.fn().mockResolvedValue({ 
    data: { id: 'test-board', title: 'Test Board', scene_json: '{}' }, 
    error: null 
  }),
  createBoard: jest.fn(),
  saveBoardScene: jest.fn().mockResolvedValue({ error: null }),
  getUserProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
  updateUserProfile: jest.fn(),
  getInviteByToken: jest.fn().mockResolvedValue({ data: null, error: null }),
  acceptInvite: jest.fn().mockResolvedValue({ data: null, error: null }),
}));

// Mock usePresence hook
jest.mock('./hooks/usePresence', () => ({
  usePresence: jest.fn(() => ({
    onlineUsers: [],
    remoteCursors: {},
    updateCursor: jest.fn(),
    leaveCursor: jest.fn(),
  })),
}));

// Mock canvas
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

beforeAll(() => {
  HTMLCanvasElement.prototype.getContext = jest.fn(() => createMockContext());
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mock');
  HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
    left: 0, top: 0, width: 1920, height: 1080, right: 1920, bottom: 1080,
  }));
});

import App from './App';

describe('App Component', () => {
  describe('App Rendering', () => {
    test('renders without crashing', async () => {
      render(<App />);
      
      await waitFor(() => {
        expect(document.body).toBeInTheDocument();
      });
    });
  });
});
