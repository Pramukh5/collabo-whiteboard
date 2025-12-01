# Collabo Whiteboard - AI Coding Agent Instructions

## Architecture Overview

This is a real-time collaborative whiteboard application with a **client-server architecture**:

- **Client**: React 19 app (CRA-based) in `src/` using Socket.IO client for real-time communication
- **Server**: Standalone Express + Socket.IO server in `server/` that broadcasts drawing events
- **Communication**: WebSocket events (`draw`, `text`, `undo`, `redo`) broadcasted to all connected clients

The server is intentionally minimal - it only broadcasts events without storing state. All drawing state lives client-side in the canvas and undo/redo stacks.

## Development Workflow

**Two-process development setup required:**

1. Start backend server: `cd server && node index.js` (runs on port 5000)
2. Start React client: `npm start` (runs on port 3000, proxies to localhost:5000)

The client hardcodes `http://localhost:5000` in `src/App.js` for the Socket.IO connection. Both must run simultaneously for the app to function.

## Key Components & Patterns

### State Management Pattern (src/components/Whiteboard.js)

- **Canvas state**: Managed via `useRef` for `canvasRef` and `ctxRef` - never in React state (performance)
- **Undo/Redo**: Uses image snapshot stacks (`undoStack.current`, `redoStack.current`) storing canvas `toDataURL()` base64 strings
- **Tool switching**: Changes canvas `globalCompositeOperation` - `destination-out` for eraser, `source-over` for pen
- **Parent communication**: Uses `forwardRef` + `useImperativeHandle` to expose undo/redo methods to `App.js`

### Socket.IO Event Flow

**Outgoing events (emitted by client):**
- `draw`: `{ x, y, color, size, tool }` - sent on every mouse move while drawing
- `text`: `{ text, x, y, color }` - sent when user places text
- `undo`/`redo`: Sends base64 image state to sync across clients

**Incoming events (server broadcasts to others):**
- Server uses `socket.broadcast.emit()` to avoid echoing back to sender
- Clients apply received drawing commands directly to their canvas context

### Canvas Drawing Lifecycle

1. `startDrawing`: Configures ctx based on tool, calls `beginPath()`, `moveTo()`
2. `draw`: While mouse down, calls `lineTo()` + `stroke()`, emits to socket
3. `stopDrawing`: Calls `closePath()`, saves state to undo stack
4. State saving happens **after each stroke**, not per-point (critical for performance)

## Project-Specific Conventions

- **Eraser implementation**: Not a separate color - uses `globalCompositeOperation = 'destination-out'` with 4x line width
- **Text tool**: Uses `prompt()` for input (not a React controlled component) and renders with `ctx.fillText()`
- **No persistence**: Refreshing loses all drawings - design decision, not a bug
- **Keyboard shortcuts**: Handled in `Whiteboard.js` via `window.addEventListener`, not in `Toolbar.js`
- **Canvas sizing**: Set to `window.innerWidth/innerHeight` on mount, doesn't resize dynamically

## Testing & Dependencies

- React Testing Library configured (`setupTests.js` imports jest-dom)
- No custom tests written yet - uses CRA defaults
- Socket.IO versions must match: both client (`socket.io-client@^4.8.1`) and server (`socket.io@^4.8.1`) use v4.8.1

## Critical Gotchas

- **StrictMode double-mounting**: React 19's StrictMode causes double socket connections in dev - this is expected
- **CORS**: Server allows all origins (`cors: { origin: "*" }`) - acceptable for local dev, needs hardening for production
- **Undo/redo syncing**: Currently broadcasts image state on each undo/redo - bandwidth-intensive for large canvases
- **Canvas event handlers**: Attached conditionally based on tool - `onMouseDown={tool === "pen" || tool === "erase" ? startDrawing : null}`
