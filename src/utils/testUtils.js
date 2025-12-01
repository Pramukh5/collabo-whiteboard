/**
 * Test Utilities for Collabo Whiteboard
 * 
 * Common mocks, helpers, and utilities used across test files.
 */

import { render } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../contexts/AuthContext';

/**
 * Custom render function that wraps components with necessary providers
 */
export function renderWithProviders(ui, { route = '/', ...options } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        {ui}
      </AuthProvider>
    </MemoryRouter>,
    options
  );
}

/**
 * Create a mock socket for testing
 */
export function createMockSocket() {
  const eventHandlers = {};
  
  return {
    on: jest.fn((event, handler) => {
      eventHandlers[event] = eventHandlers[event] || [];
      eventHandlers[event].push(handler);
    }),
    emit: jest.fn(),
    off: jest.fn((event, handler) => {
      if (eventHandlers[event]) {
        eventHandlers[event] = eventHandlers[event].filter(h => h !== handler);
      }
    }),
    disconnect: jest.fn(),
    connect: jest.fn(),
    connected: true,
    // Helper to simulate receiving events
    simulateEvent: (event, data) => {
      if (eventHandlers[event]) {
        eventHandlers[event].forEach(handler => handler(data));
      }
    },
    // Get all registered handlers for an event
    getHandlers: (event) => eventHandlers[event] || [],
  };
}

/**
 * Create a mock canvas context
 */
export function createMockCanvasContext() {
  return {
    lineJoin: '',
    lineCap: '',
    strokeStyle: '',
    lineWidth: 0,
    globalCompositeOperation: '',
    fillStyle: '',
    font: '',
    textBaseline: '',
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
    createLinearGradient: jest.fn(() => ({
      addColorStop: jest.fn(),
    })),
    measureText: jest.fn(() => ({ width: 100 })),
    getImageData: jest.fn(() => ({ data: new Uint8ClampedArray(4) })),
    putImageData: jest.fn(),
  };
}

/**
 * Mock user for testing authenticated routes
 */
export const mockUser = {
  id: 'test-user-123',
  email: 'test@example.com',
  user_metadata: {
    display_name: 'Test User',
    avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=TU',
  },
};

/**
 * Mock session for testing
 */
export const mockSession = {
  user: mockUser,
  access_token: 'mock-access-token-12345',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  expires_at: Date.now() + 3600000,
};

/**
 * Mock board data
 */
export const mockBoard = {
  id: 'board-123',
  title: 'Test Board',
  owner_id: 'test-user-123',
  scene_json: JSON.stringify({
    objects: [],
    stickyNotes: [],
  }),
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  collaborators: [],
};

/**
 * Mock profile data
 */
export const mockProfile = {
  id: 'test-user-123',
  display_name: 'Test User',
  avatar_url: 'https://api.dicebear.com/7.x/initials/svg?seed=TU',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

/**
 * Wait helper for async operations
 */
export function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Setup canvas mock on HTMLCanvasElement
 */
export function setupCanvasMock() {
  const mockCtx = createMockCanvasContext();
  
  HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCtx);
  HTMLCanvasElement.prototype.toDataURL = jest.fn(() => 'data:image/png;base64,mockImageData');
  HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
    left: 0,
    top: 0,
    width: 1920,
    height: 1080,
    right: 1920,
    bottom: 1080,
  }));
  
  return mockCtx;
}

/**
 * Generate random drawing data for tests
 */
export function generateRandomStroke() {
  const points = [];
  const numPoints = Math.floor(Math.random() * 20) + 5;
  
  let x = Math.random() * 500;
  let y = Math.random() * 500;
  
  for (let i = 0; i < numPoints; i++) {
    x += (Math.random() - 0.5) * 50;
    y += (Math.random() - 0.5) * 50;
    points.push({ x, y });
  }
  
  return {
    type: 'stroke',
    points,
    color: `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    size: Math.floor(Math.random() * 10) + 1,
    tool: 'pen',
  };
}

/**
 * Generate random sticky note for tests
 */
export function generateRandomStickyNote() {
  const colors = ['#fff740', '#ff7eb9', '#7afcff', '#feff9c', '#ff65a3'];
  
  return {
    id: `note-${Math.random().toString(36).substr(2, 9)}`,
    x: Math.random() * 800,
    y: Math.random() * 600,
    width: 200,
    height: 200,
    content: `Test note ${Math.floor(Math.random() * 100)}`,
    color: colors[Math.floor(Math.random() * colors.length)],
  };
}

/**
 * Simulate mouse events on canvas
 */
export function simulateDrawing(canvas, startPoint, endPoint) {
  const { fireEvent } = require('@testing-library/react');
  
  fireEvent.mouseDown(canvas, {
    clientX: startPoint.x,
    clientY: startPoint.y,
    button: 0,
  });
  
  fireEvent.mouseMove(canvas, {
    clientX: endPoint.x,
    clientY: endPoint.y,
  });
  
  fireEvent.mouseUp(canvas);
}

/**
 * Simulate touch events for mobile testing
 */
export function simulateTouchDrawing(canvas, startPoint, endPoint) {
  const { fireEvent } = require('@testing-library/react');
  
  fireEvent.touchStart(canvas, {
    touches: [{ clientX: startPoint.x, clientY: startPoint.y }],
  });
  
  fireEvent.touchMove(canvas, {
    touches: [{ clientX: endPoint.x, clientY: endPoint.y }],
  });
  
  fireEvent.touchEnd(canvas, {
    touches: [],
  });
}
