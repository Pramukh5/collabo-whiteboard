import { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from "react";

const Whiteboard = forwardRef(({ 
  socket, 
  roomId, 
  color, 
  size, 
  tool, 
  onZoomChange, 
  initialScene, 
  onSceneChange,
  // Supabase Presence props (optional - falls back to socket if not provided)
  remoteCursors: presenceRemoteCursors,
  onlineUsers,
  onCursorMove,
  onCursorLeave,
}, ref) => {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [texts, setTexts] = useState([]);
  const [textInput, setTextInput] = useState(null);
  const [inputValue, setInputValue] = useState("");

  // Selection and movement state
  const [objects, setObjects] = useState([]);
  const [selectedObject, setSelectedObject] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null);
  const [resizeStartData, setResizeStartData] = useState(null);
  const [cursorStyle, setCursorStyle] = useState('default');

  // Sticky notes state
  const [stickyNotes, setStickyNotes] = useState([]);
  const [draggingStickyNote, setDraggingStickyNote] = useState(null);
  const [stickyNoteDragOffset, setStickyNoteDragOffset] = useState({ x: 0, y: 0 });
  const [selectedStickyNote, setSelectedStickyNote] = useState(null);
  const [resizingStickyNote, setResizingStickyNote] = useState(null);
  const [stickyNoteResizeHandle, setStickyNoteResizeHandle] = useState(null);
  const [stickyNoteResizeStart, setStickyNoteResizeStart] = useState(null);

  // Zoom and Pan state (Figma-like)
  const [viewportTransform, setViewportTransform] = useState({
    scale: 1,
    translateX: 0,
    translateY: 0
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Touch/Mobile state
  const [isTouching, setIsTouching] = useState(false);
  const [touchMode, setTouchMode] = useState(null); // 'draw', 'pan', 'pinch', 'select'
  const [lastTouchDistance, setLastTouchDistance] = useState(null);
  const [lastTouchCenter, setLastTouchCenter] = useState(null);
  const [isApplePencil, setIsApplePencil] = useState(false);
  const touchStartRef = useRef(null);

  const currentStroke = useRef([]);
  const remoteStrokes = useRef({}); // Track remote users' ongoing strokes by socket ID
  const [liveStroke, setLiveStroke] = useState(null); // Current user's live stroke for rendering

  // Shape drawing state
  const [isDrawingShape, setIsDrawingShape] = useState(false);
  const [shapeStart, setShapeStart] = useState(null);
  const [liveShape, setLiveShape] = useState(null);

  // Remote collaborator cursors (local state for socket-based, or use presence-based)
  const [socketRemoteCursors, setSocketRemoteCursors] = useState({});
  // Use Supabase Presence cursors if available, otherwise fall back to socket-based
  const remoteCursors = presenceRemoteCursors || socketRemoteCursors;
  const cursorThrottleRef = useRef(null);

  const undoStack = useRef([]);
  const redoStack = useRef([]);
  const isInitialized = useRef(false);
  const initialSceneLoaded = useRef(false);
  const autoSaveTimeoutRef = useRef(null);
  const lastSavedSceneRef = useRef(null);

  // Auto-save function with debounce and change detection
  const triggerAutoSave = useCallback(() => {
    if (!onSceneChange) return;
    
    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    // Debounce: save after 1 second of no changes
    autoSaveTimeoutRef.current = setTimeout(() => {
      const sceneData = {
        objects: objects.filter(obj => !obj.deleted),
        stickyNotes: stickyNotes,
      };
      
      // Check if scene has actually changed
      const currentSceneJson = JSON.stringify(sceneData);
      if (currentSceneJson === lastSavedSceneRef.current) {
        console.log('No changes detected, skipping save');
        return;
      }
      
      console.log('Changes detected, auto-saving scene...');
      lastSavedSceneRef.current = currentSceneJson;
      onSceneChange(sceneData);
    }, 1000);
  }, [onSceneChange, objects, stickyNotes]);

  // Trigger auto-save when objects or sticky notes change
  useEffect(() => {
    if (initialSceneLoaded.current) {
      triggerAutoSave();
    }
  }, [objects, stickyNotes, triggerAutoSave]);

  // Load initial scene
  useEffect(() => {
    if (initialScene && !initialSceneLoaded.current) {
      console.log('Loading initial scene:', initialScene);
      if (initialScene.objects && Array.isArray(initialScene.objects)) {
        setObjects(initialScene.objects);
      }
      if (initialScene.stickyNotes && Array.isArray(initialScene.stickyNotes)) {
        setStickyNotes(initialScene.stickyNotes);
      }
      // Store initial scene as last saved state
      lastSavedSceneRef.current = JSON.stringify({
        objects: initialScene.objects || [],
        stickyNotes: initialScene.stickyNotes || [],
      });
      initialSceneLoaded.current = true;
    }
  }, [initialScene]);

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    // Only set canvas dimensions on first mount
    if (!isInitialized.current) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      isInitialized.current = true;
    }

    const ctx = canvas.getContext("2d");
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctxRef.current = ctx;

    // Only save initial blank state on first mount
    if (undoStack.current.length === 0) {
      saveState();
    }
  }, [color, size]);

  const saveState = () => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL();
    undoStack.current.push(imageData);
    redoStack.current = []; // Clear redo stack when new action is made
  };

  // Convert screen coordinates to canvas coordinates
  const screenToCanvas = (screenX, screenY) => {
    const { scale, translateX, translateY } = viewportTransform;
    return {
      x: (screenX - translateX) / scale,
      y: (screenY - translateY) / scale
    };
  };

  // Convert canvas coordinates to screen coordinates
  const canvasToScreen = (canvasX, canvasY) => {
    const { scale, translateX, translateY } = viewportTransform;
    return {
      x: canvasX * scale + translateX,
      y: canvasY * scale + translateY
    };
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;

    // Save current context state
    ctx.save();

    // Clear entire canvas (reset transform first)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply viewport transformation
    ctx.translate(viewportTransform.translateX, viewportTransform.translateY);
    ctx.scale(viewportTransform.scale, viewportTransform.scale);

    // Redraw all objects
    objects.forEach((obj) => {
      if (obj.deleted) return;
      if (obj.type === 'stroke') {
        ctx.globalCompositeOperation = obj.tool === 'erase' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.tool === 'erase' ? obj.size * 4 : obj.size;
        ctx.beginPath();
        obj.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      } else if (obj.type === 'text') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = obj.color;
        const fontSize = obj.fontSize || 20;
        ctx.font = `${fontSize}px Arial`;
        ctx.fillText(obj.text, obj.x, obj.y);
      } else if (obj.type === 'rectangle') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.beginPath();
        ctx.rect(obj.x, obj.y, obj.width, obj.height);
        ctx.stroke();
        if (obj.fill) {
          ctx.fillStyle = obj.fill;
          ctx.fill();
        }
      } else if (obj.type === 'ellipse') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.beginPath();
        const centerX = obj.x + obj.width / 2;
        const centerY = obj.y + obj.height / 2;
        ctx.ellipse(centerX, centerY, Math.abs(obj.width / 2), Math.abs(obj.height / 2), 0, 0, 2 * Math.PI);
        ctx.stroke();
        if (obj.fill) {
          ctx.fillStyle = obj.fill;
          ctx.fill();
        }
      } else if (obj.type === 'triangle') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.beginPath();
        // Triangle points: top center, bottom left, bottom right
        ctx.moveTo(obj.x + obj.width / 2, obj.y);
        ctx.lineTo(obj.x, obj.y + obj.height);
        ctx.lineTo(obj.x + obj.width, obj.y + obj.height);
        ctx.closePath();
        ctx.stroke();
        if (obj.fill) {
          ctx.fillStyle = obj.fill;
          ctx.fill();
        }
      } else if (obj.type === 'line') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.lineWidth = obj.size;
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
      } else if (obj.type === 'arrow') {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = obj.color;
        ctx.fillStyle = obj.color;
        ctx.lineWidth = obj.size;
        
        // Draw line
        ctx.beginPath();
        ctx.moveTo(obj.x1, obj.y1);
        ctx.lineTo(obj.x2, obj.y2);
        ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(obj.y2 - obj.y1, obj.x2 - obj.x1);
        const headLength = 15 + obj.size * 2;
        ctx.beginPath();
        ctx.moveTo(obj.x2, obj.y2);
        ctx.lineTo(
          obj.x2 - headLength * Math.cos(angle - Math.PI / 6),
          obj.y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          obj.x2 - headLength * Math.cos(angle + Math.PI / 6),
          obj.y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    });

    // Draw live shape preview
    if (liveShape) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = liveShape.color;
      ctx.lineWidth = liveShape.size;
      ctx.setLineDash([5 / viewportTransform.scale, 5 / viewportTransform.scale]);
      
      if (liveShape.type === 'rectangle') {
        ctx.beginPath();
        ctx.rect(liveShape.x, liveShape.y, liveShape.width, liveShape.height);
        ctx.stroke();
      } else if (liveShape.type === 'ellipse') {
        ctx.beginPath();
        const centerX = liveShape.x + liveShape.width / 2;
        const centerY = liveShape.y + liveShape.height / 2;
        ctx.ellipse(centerX, centerY, Math.abs(liveShape.width / 2), Math.abs(liveShape.height / 2), 0, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (liveShape.type === 'triangle') {
        ctx.beginPath();
        ctx.moveTo(liveShape.x + liveShape.width / 2, liveShape.y);
        ctx.lineTo(liveShape.x, liveShape.y + liveShape.height);
        ctx.lineTo(liveShape.x + liveShape.width, liveShape.y + liveShape.height);
        ctx.closePath();
        ctx.stroke();
      } else if (liveShape.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(liveShape.x1, liveShape.y1);
        ctx.lineTo(liveShape.x2, liveShape.y2);
        ctx.stroke();
      } else if (liveShape.type === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(liveShape.x1, liveShape.y1);
        ctx.lineTo(liveShape.x2, liveShape.y2);
        ctx.stroke();
        
        // Draw arrowhead preview
        const angle = Math.atan2(liveShape.y2 - liveShape.y1, liveShape.x2 - liveShape.x1);
        const headLength = 15 + liveShape.size * 2;
        ctx.setLineDash([]);
        ctx.fillStyle = liveShape.color;
        ctx.beginPath();
        ctx.moveTo(liveShape.x2, liveShape.y2);
        ctx.lineTo(
          liveShape.x2 - headLength * Math.cos(angle - Math.PI / 6),
          liveShape.y2 - headLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          liveShape.x2 - headLength * Math.cos(angle + Math.PI / 6),
          liveShape.y2 - headLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
      ctx.setLineDash([]);
    }

    // Draw current user's live stroke
    if (liveStroke && liveStroke.points.length > 0) {
      ctx.globalCompositeOperation = liveStroke.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = liveStroke.color;
      ctx.lineWidth = liveStroke.tool === 'erase' ? liveStroke.size * 4 : liveStroke.size;
      ctx.beginPath();
      liveStroke.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.stroke();
    }

    // Draw remote users' live strokes
    Object.values(remoteStrokes.current).forEach(stroke => {
      if (stroke && stroke.points.length > 0) {
        ctx.globalCompositeOperation = stroke.tool === 'erase' ? 'destination-out' : 'source-over';
        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.tool === 'erase' ? stroke.size * 4 : stroke.size;
        ctx.beginPath();
        stroke.points.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke();
      }
    });

    // Highlight selected object
    if (selectedObject !== null && objects[selectedObject] && !objects[selectedObject].deleted) {
      const obj = objects[selectedObject];
      const bounds = getObjectBounds(obj);
      
      if (bounds) {
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = 2 / viewportTransform.scale;
        ctx.setLineDash([5 / viewportTransform.scale, 5 / viewportTransform.scale]);
        
        // Draw bounding box
        ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        ctx.setLineDash([]);
        
        // Draw resize handles (8 handles: corners + edges)
        // Use larger handles for touch devices
        const handles = getResizeHandles(obj);
        const isTouchDevice = 'ontouchstart' in window || isTouching;
        const handleSize = (isTouchDevice ? 16 : 8) / viewportTransform.scale;
        
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0066ff';
        ctx.lineWidth = (isTouchDevice ? 2 : 1.5) / viewportTransform.scale;
        
        for (let [handle, pos] of Object.entries(handles)) {
          // Draw circular handles for touch devices, square for desktop
          if (isTouchDevice) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, handleSize / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.fillRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
            ctx.strokeRect(pos.x - handleSize / 2, pos.y - handleSize / 2, handleSize, handleSize);
          }
        }
      }
    }

    // Restore context state
    ctx.restore();
  };

  const undo = () => {
    if (undoStack.current.length <= 1) return;

    const currentState = undoStack.current.pop();
    redoStack.current.push(currentState);

    const previousState = undoStack.current[undoStack.current.length - 1];
    restoreState(previousState);

    socket.emit("undo", { roomId, imageData: previousState });
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;

    const nextState = redoStack.current.pop();
    undoStack.current.push(nextState);
    restoreState(nextState);

    socket.emit("redo", { roomId, imageData: nextState });
  };

  const restoreState = (imageData) => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    const img = new Image();
    img.src = imageData;
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };
  };

  useEffect(() => {
    if (!socket) return;

    // Receive initial canvas state when connecting
    socket.on("init", (initialState) => {
      console.log("Received initial state:", initialState);
      setObjects(initialState);
    });

    socket.on("draw", ({ socketId, x, y, color, size, tool, isStart }) => {
      if (isStart) {
        // Start a new remote stroke
        remoteStrokes.current[socketId] = {
          points: [{ x, y }],
          color,
          size,
          tool
        };
      } else {
        // Add point to existing remote stroke
        if (remoteStrokes.current[socketId]) {
          remoteStrokes.current[socketId].points.push({ x, y });
        }
      }
      // Trigger re-render to show live stroke
      setLiveStroke(prev => prev ? { ...prev } : null);
    });

    socket.on("text", (data) => {
      const newObj = { type: 'text', ...data };
      setObjects(prev => [...prev, newObj]);
    });

    socket.on("stroke", ({ socketId, ...data }) => {
      // Clear the remote stroke and add as completed object
      delete remoteStrokes.current[socketId];
      const newObj = { type: 'stroke', ...data };
      setObjects(prev => [...prev, newObj]);
    });

    socket.on("move", ({ index, deltaX, deltaY }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index]) {
          const obj = updated[index];
          if (obj.type === 'stroke') {
            updated[index] = {
              ...obj,
              points: obj.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }))
            };
          } else if (obj.type === 'text') {
            updated[index] = {
              ...obj,
              x: obj.x + deltaX,
              y: obj.y + deltaY
            };
          } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
            updated[index] = {
              ...obj,
              x: obj.x + deltaX,
              y: obj.y + deltaY
            };
          } else if (obj.type === 'line' || obj.type === 'arrow') {
            updated[index] = {
              ...obj,
              x1: obj.x1 + deltaX,
              y1: obj.y1 + deltaY,
              x2: obj.x2 + deltaX,
              y2: obj.y2 + deltaY
            };
          }
        }
        return updated;
      });
    });

    socket.on("resize", ({ index, fontSize }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index] && updated[index].type === 'text') {
          updated[index] = {
            ...updated[index],
            fontSize
          };
        }
        return updated;
      });
    });

    socket.on("resizeStroke", ({ index, points }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index] && updated[index].type === 'stroke') {
          updated[index] = {
            ...updated[index],
            points
          };
        }
        return updated;
      });
    });

    socket.on("shape", (data) => {
      setObjects(prev => [...prev, data]);
    });

    socket.on("resizeShape", ({ index, x, y, width, height }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index] && (updated[index].type === 'rectangle' || updated[index].type === 'ellipse' || updated[index].type === 'triangle')) {
          updated[index] = {
            ...updated[index],
            x, y, width, height
          };
        }
        return updated;
      });
    });

    socket.on("resizeLine", ({ index, x1, y1, x2, y2 }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index] && (updated[index].type === 'line' || updated[index].type === 'arrow')) {
          updated[index] = {
            ...updated[index],
            x1, y1, x2, y2
          };
        }
        return updated;
      });
    });

    socket.on("undo", ({ imageData }) => {
      restoreState(imageData);
    });

    socket.on("redo", ({ imageData }) => {
      restoreState(imageData);
    });

    socket.on("clear", () => {
      setObjects([]);
    });

    socket.on("stickyNote:create", (note) => {
      setStickyNotes(prev => [...prev, note]);
    });

    // Remote cursor tracking (only used if Supabase Presence is not available)
    if (!presenceRemoteCursors) {
      socket.on("cursor:move", ({ odId, x, y, userName, userColor }) => {
        setSocketRemoteCursors(prev => ({
          ...prev,
          [odId]: { x, y, userName, userColor, lastUpdate: Date.now() }
        }));
      });

      socket.on("cursor:leave", ({ odId }) => {
        setSocketRemoteCursors(prev => {
          const updated = { ...prev };
          delete updated[odId];
          return updated;
        });
      });

      socket.on("user:left", ({ odId }) => {
        setSocketRemoteCursors(prev => {
          const updated = { ...prev };
          delete updated[odId];
          return updated;
        });
      });
    }

    socket.on("user:joined", ({ odId, userName, userColor }) => {
      console.log(`User ${userName} joined the room`);
    });

    socket.on("stickyNote:update", ({ id, text }) => {
      setStickyNotes(prev => prev.map(note =>
        note.id === id ? { ...note, text } : note
      ));
    });

    socket.on("stickyNote:move", ({ id, x, y }) => {
      setStickyNotes(prev => prev.map(note =>
        note.id === id ? { ...note, x, y } : note
      ));
    });

    socket.on("stickyNote:resize", ({ id, x, y, width, height }) => {
      setStickyNotes(prev => prev.map(note =>
        note.id === id ? { ...note, x, y, width, height } : note
      ));
    });

    socket.on("stickyNote:delete", ({ id }) => {
      setStickyNotes(prev => prev.filter(note => note.id !== id));
    });

    socket.on("delete", ({ index }) => {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[index]) {
          updated[index] = { ...updated[index], deleted: true };
        }
        return updated;
      });
    });

    // Listen for keyboard shortcuts
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        redo();
      }
      // Reset zoom and pan (Ctrl+0 or Cmd+0)
      if ((e.ctrlKey || e.metaKey) && e.key === '0') {
        e.preventDefault();
        setViewportTransform({ scale: 1, translateX: 0, translateY: 0 });
      }
      // Zoom in (Ctrl+= or Ctrl++)
      if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setViewportTransform(prev => ({
          ...prev,
          scale: Math.min(10, prev.scale * 1.2)
        }));
      }
      // Zoom out (Ctrl+-)
      if ((e.ctrlKey || e.metaKey) && e.key === '-') {
        e.preventDefault();
        setViewportTransform(prev => ({
          ...prev,
          scale: Math.max(0.1, prev.scale / 1.2)
        }));
      }
      // Delete selected object
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObject !== null) {
          deleteSelectedObject();
        } else if (selectedStickyNote !== null) {
          deleteSelectedStickyNote();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      socket.off("init");
      socket.off("draw");
      socket.off("text");
      socket.off("stroke");
      socket.off("shape");
      socket.off("move");
      socket.off("resize");
      socket.off("resizeStroke");
      socket.off("resizeShape");
      socket.off("resizeLine");
      socket.off("undo");
      socket.off("redo");
      socket.off("clear");
      socket.off("stickyNote:create");
      socket.off("stickyNote:update");
      socket.off("stickyNote:move");
      socket.off("stickyNote:resize");
      socket.off("stickyNote:delete");
      socket.off("delete");
      socket.off("cursor:move");
      socket.off("cursor:leave");
      socket.off("user:joined");
      socket.off("user:left");
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [socket]);

  // Clean up stale remote cursors (only for socket-based cursors, Presence handles its own cleanup)
  useEffect(() => {
    if (presenceRemoteCursors) return; // Skip if using Supabase Presence
    
    const interval = setInterval(() => {
      const now = Date.now();
      setSocketRemoteCursors(prev => {
        const updated = { ...prev };
        let changed = false;
        for (const [id, cursor] of Object.entries(updated)) {
          if (now - cursor.lastUpdate > 5000) {
            delete updated[id];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [presenceRemoteCursors]);

  // Emit cursor leave when component unmounts or window loses focus
  useEffect(() => {
    const emitCursorLeave = () => {
      if (onCursorLeave) {
        onCursorLeave();
      } else if (socket) {
        socket.emit("cursor:leave", { roomId });
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        emitCursorLeave();
      }
    };

    const handleBeforeUnload = () => {
      emitCursorLeave();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      emitCursorLeave();
    };
  }, [socket, roomId, onCursorLeave]);

  // Add global mouse event listeners for sticky note dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e) => handleStickyNoteMouseMove(e);
    const handleMouseUp = () => handleStickyNoteMouseUp();

    if (draggingStickyNote || resizingStickyNote) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [draggingStickyNote, resizingStickyNote, stickyNoteDragOffset, stickyNoteResizeStart]);

  // Handle zoom with mouse wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e) => {
      e.preventDefault();

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom factor
      const zoomIntensity = 0.1;
      const delta = e.deltaY > 0 ? -1 : 1;
      const scaleFactor = 1 + delta * zoomIntensity;

      setViewportTransform(prev => {
        const newScale = Math.max(0.1, Math.min(10, prev.scale * scaleFactor));

        // Zoom towards mouse position
        const newTranslateX = mouseX - (mouseX - prev.translateX) * (newScale / prev.scale);
        const newTranslateY = mouseY - (mouseY - prev.translateY) * (newScale / prev.scale);

        return {
          scale: newScale,
          translateX: newTranslateX,
          translateY: newTranslateY
        };
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Touch utility functions
  const getTouchDistance = (touch1, touch2) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getTouchCenter = (touch1, touch2) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const isApplePencilTouch = (touch) => {
    // Apple Pencil has touchType 'stylus' and force > 0
    return touch.touchType === 'stylus' || 
           (touch.force !== undefined && touch.force > 0 && touch.radiusX < 5);
  };

  // Touch event handlers for mobile/tablet support
  const handleTouchStart = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touches = e.touches;

    // Detect Apple Pencil
    if (touches.length === 1) {
      const touch = touches[0];
      setIsApplePencil(isApplePencilTouch(touch));
    }

    // Pinch zoom with two fingers
    if (touches.length === 2) {
      e.preventDefault();
      setTouchMode('pinch');
      const distance = getTouchDistance(touches[0], touches[1]);
      const center = getTouchCenter(touches[0], touches[1]);
      setLastTouchDistance(distance);
      setLastTouchCenter({ x: center.x - rect.left, y: center.y - rect.top });
      return;
    }

    // Single finger touch
    if (touches.length === 1) {
      const touch = touches[0];
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;
      
      touchStartRef.current = { x: offsetX, y: offsetY, time: Date.now() };

      // If Apple Pencil, always draw regardless of tool
      if (isApplePencilTouch(touch) && tool !== 'select' && tool !== 'pan') {
        setTouchMode('draw');
        startDrawing({ nativeEvent: { offsetX, offsetY, button: 0 } });
        return;
      }

      // Pan tool or finger on touch device (not Apple Pencil)
      if (tool === 'pan') {
        setTouchMode('pan');
        setIsPanning(true);
        setPanStart({ x: offsetX, y: offsetY });
        return;
      }

      // For drawing tools
      const drawingTools = ['pen', 'erase', 'rectangle', 'ellipse', 'triangle', 'line', 'arrow'];
      if (drawingTools.includes(tool)) {
        setTouchMode('draw');
        setIsTouching(true);
        startDrawing({ nativeEvent: { offsetX, offsetY, button: 0 } });
        return;
      }

      // Select and other tools
      setTouchMode('select');
      setIsTouching(true);
      startDrawing({ nativeEvent: { offsetX, offsetY, button: 0 } });
    }
  };

  const handleTouchMove = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const touches = e.touches;

    // Pinch zoom
    if (touches.length === 2 && touchMode === 'pinch') {
      e.preventDefault();
      const newDistance = getTouchDistance(touches[0], touches[1]);
      const newCenter = getTouchCenter(touches[0], touches[1]);
      const centerX = newCenter.x - rect.left;
      const centerY = newCenter.y - rect.top;

      if (lastTouchDistance && lastTouchCenter) {
        // Calculate scale change
        const scaleFactor = newDistance / lastTouchDistance;
        
        // Calculate pan (movement of center point)
        const panDeltaX = centerX - lastTouchCenter.x;
        const panDeltaY = centerY - lastTouchCenter.y;

        setViewportTransform(prev => {
          const newScale = Math.max(0.1, Math.min(10, prev.scale * scaleFactor));
          
          // Zoom towards pinch center
          const scaleRatio = newScale / prev.scale;
          const newTranslateX = centerX - (centerX - prev.translateX) * scaleRatio + panDeltaX;
          const newTranslateY = centerY - (centerY - prev.translateY) * scaleRatio + panDeltaY;

          return {
            scale: newScale,
            translateX: newTranslateX,
            translateY: newTranslateY
          };
        });

        setLastTouchDistance(newDistance);
        setLastTouchCenter({ x: centerX, y: centerY });
      }
      return;
    }

    // Single finger touch
    if (touches.length === 1) {
      const touch = touches[0];
      const offsetX = touch.clientX - rect.left;
      const offsetY = touch.clientY - rect.top;

      // Pan mode
      if (touchMode === 'pan' && isPanning) {
        const deltaX = offsetX - panStart.x;
        const deltaY = offsetY - panStart.y;

        setViewportTransform(prev => ({
          ...prev,
          translateX: prev.translateX + deltaX,
          translateY: prev.translateY + deltaY
        }));

        setPanStart({ x: offsetX, y: offsetY });
        return;
      }

      // Drawing/Selection
      if (touchMode === 'draw' || touchMode === 'select') {
        e.preventDefault(); // Prevent scrolling while drawing
        draw({ nativeEvent: { offsetX, offsetY } });
      }
    }
  };

  const handleTouchEnd = (e) => {
    const touches = e.touches;

    // If still have touches, don't end everything
    if (touches.length > 0) {
      // Reset pinch state if went from 2 to 1 finger
      if (touchMode === 'pinch' && touches.length === 1) {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const touch = touches[0];
        const offsetX = touch.clientX - rect.left;
        const offsetY = touch.clientY - rect.top;
        
        // Switch to pan mode
        setTouchMode('pan');
        setIsPanning(true);
        setPanStart({ x: offsetX, y: offsetY });
        setLastTouchDistance(null);
        setLastTouchCenter(null);
      }
      return;
    }

    // All touches ended
    stopDrawing();
    setIsTouching(false);
    setTouchMode(null);
    setLastTouchDistance(null);
    setLastTouchCenter(null);
    setIsApplePencil(false);
  };

  // Touch event handler for sticky notes
  const handleStickyNoteTouchStart = (e, noteId, isResizeHandle = false, handle = null) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    e.preventDefault();
    e.stopPropagation();

    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;

    setSelectedStickyNote(noteId);

    if (isResizeHandle && handle) {
      setResizingStickyNote(noteId);
      setStickyNoteResizeHandle(handle);
      setStickyNoteResizeStart({
        x: touch.clientX,
        y: touch.clientY,
        width: note.width,
        height: note.height,
        noteX: note.x,
        noteY: note.y
      });
    } else {
      setDraggingStickyNote(noteId);
      setStickyNoteDragOffset({
        x: touch.clientX - note.x,
        y: touch.clientY - note.y
      });
    }
  };

  const handleStickyNoteTouchMove = (e) => {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    
    if (resizingStickyNote && stickyNoteResizeStart) {
      e.preventDefault();
      const deltaX = touch.clientX - stickyNoteResizeStart.x;
      const deltaY = touch.clientY - stickyNoteResizeStart.y;
      const handle = stickyNoteResizeHandle;
      
      setStickyNotes(prev => prev.map(note => {
        if (note.id !== resizingStickyNote) return note;
        
        let newX = stickyNoteResizeStart.noteX;
        let newY = stickyNoteResizeStart.noteY;
        let newWidth = stickyNoteResizeStart.width;
        let newHeight = stickyNoteResizeStart.height;
        
        if (handle.includes('e')) newWidth = Math.max(100, stickyNoteResizeStart.width + deltaX);
        if (handle.includes('w')) {
          const widthChange = Math.min(deltaX, stickyNoteResizeStart.width - 100);
          newWidth = Math.max(100, stickyNoteResizeStart.width - deltaX);
          newX = stickyNoteResizeStart.noteX + widthChange;
        }
        if (handle.includes('s')) newHeight = Math.max(100, stickyNoteResizeStart.height + deltaY);
        if (handle.includes('n')) {
          const heightChange = Math.min(deltaY, stickyNoteResizeStart.height - 100);
          newHeight = Math.max(100, stickyNoteResizeStart.height - deltaY);
          newY = stickyNoteResizeStart.noteY + heightChange;
        }
        
        return { ...note, x: newX, y: newY, width: newWidth, height: newHeight };
      }));
    } else if (draggingStickyNote) {
      e.preventDefault();
      const newX = touch.clientX - stickyNoteDragOffset.x;
      const newY = touch.clientY - stickyNoteDragOffset.y;

      setStickyNotes(prev => prev.map(note =>
        note.id === draggingStickyNote ? { ...note, x: newX, y: newY } : note
      ));
    }
  };

  const handleStickyNoteTouchEnd = () => {
    handleStickyNoteMouseUp();
  };

  // Add global touch event listeners for sticky note dragging
  useEffect(() => {
    const handleTouchMoveGlobal = (e) => handleStickyNoteTouchMove(e);
    const handleTouchEndGlobal = () => handleStickyNoteTouchEnd();

    if (draggingStickyNote || resizingStickyNote) {
      window.addEventListener('touchmove', handleTouchMoveGlobal, { passive: false });
      window.addEventListener('touchend', handleTouchEndGlobal);

      return () => {
        window.removeEventListener('touchmove', handleTouchMoveGlobal);
        window.removeEventListener('touchend', handleTouchEndGlobal);
      };
    }
  }, [draggingStickyNote, resizingStickyNote, stickyNoteDragOffset, stickyNoteResizeStart]);

  const getStrokeBounds = (points) => {
    if (points.length === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      minX,
      maxX,
      minY,
      maxY,
      width: maxX - minX,
      height: maxY - minY
    };
  };

  // Get bounding box for any object type
  const getObjectBounds = (obj) => {
    if (obj.type === 'stroke') {
      const bounds = getStrokeBounds(obj.points);
      const padding = 5;
      return {
        x: bounds.minX - padding,
        y: bounds.minY - padding,
        width: bounds.width + padding * 2,
        height: bounds.height + padding * 2,
        centerX: bounds.minX + bounds.width / 2,
        centerY: bounds.minY + bounds.height / 2
      };
    } else if (obj.type === 'text') {
      const ctx = ctxRef.current;
      const fontSize = obj.fontSize || 20;
      ctx.font = `${fontSize}px Arial`;
      const metrics = ctx.measureText(obj.text);
      const textWidth = metrics.width;
      const textHeight = fontSize * 1.2;
      const padding = 5;

      return {
        x: obj.x - padding,
        y: obj.y - textHeight,
        width: textWidth + padding * 2,
        height: textHeight + padding,
        centerX: obj.x + textWidth / 2,
        centerY: obj.y - textHeight / 2
      };
    } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
      const padding = 5;
      const x = obj.width >= 0 ? obj.x : obj.x + obj.width;
      const y = obj.height >= 0 ? obj.y : obj.y + obj.height;
      const width = Math.abs(obj.width);
      const height = Math.abs(obj.height);
      return {
        x: x - padding,
        y: y - padding,
        width: width + padding * 2,
        height: height + padding * 2,
        centerX: x + width / 2,
        centerY: y + height / 2
      };
    } else if (obj.type === 'line' || obj.type === 'arrow') {
      const padding = 5;
      const minX = Math.min(obj.x1, obj.x2);
      const minY = Math.min(obj.y1, obj.y2);
      const maxX = Math.max(obj.x1, obj.x2);
      const maxY = Math.max(obj.y1, obj.y2);
      return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
        centerX: (minX + maxX) / 2,
        centerY: (minY + maxY) / 2
      };
    }
    return null;
  };

  // Get resize handle positions for any object
  const getResizeHandles = (obj) => {
    const bounds = getObjectBounds(obj);
    if (!bounds) return {};
    
    const handleSize = 8;
    return {
      'nw': { x: bounds.x, y: bounds.y, cursor: 'nw-resize' },
      'n': { x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'n-resize' },
      'ne': { x: bounds.x + bounds.width, y: bounds.y, cursor: 'ne-resize' },
      'e': { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'e-resize' },
      'se': { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'se-resize' },
      's': { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 's-resize' },
      'sw': { x: bounds.x, y: bounds.y + bounds.height, cursor: 'sw-resize' },
      'w': { x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'w-resize' }
    };
  };

  // Check if a point is on a resize handle (touch-friendly with larger hit area)
  const getResizeHandleAtPoint = (x, y, obj, isTouch = false) => {
    const handles = getResizeHandles(obj);
    // Use larger threshold for touch devices
    const threshold = isTouch || isTouching ? 20 : 10;
    
    for (let [handle, pos] of Object.entries(handles)) {
      if (Math.abs(x - pos.x) <= threshold && Math.abs(y - pos.y) <= threshold) {
        return { handle, cursor: pos.cursor };
      }
    }
    return null;
  };

  const isPointInStroke = (x, y, points, threshold = 10) => {
    // Use larger threshold for touch devices
    const touchThreshold = isTouching ? 20 : threshold;
    return points.some(point => {
      const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
      return distance < touchThreshold;
    });
  };

  const isPointInText = (x, y, textObj) => {
    const ctx = ctxRef.current;
    const fontSize = textObj.fontSize || 20;
    ctx.font = `${fontSize}px Arial`;
    const metrics = ctx.measureText(textObj.text);
    const textWidth = metrics.width;
    const textHeight = fontSize * 1.2;
    const padding = 5;

    return x >= textObj.x - padding && x <= textObj.x + textWidth + padding &&
      y >= textObj.y - textHeight && y <= textObj.y + padding;
  };

  const isPointInShape = (x, y, obj) => {
    const bounds = getObjectBounds(obj);
    if (!bounds) return false;
    
    // For shapes, check if point is within bounding box
    if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
      const shapeX = obj.width >= 0 ? obj.x : obj.x + obj.width;
      const shapeY = obj.height >= 0 ? obj.y : obj.y + obj.height;
      const width = Math.abs(obj.width);
      const height = Math.abs(obj.height);
      const threshold = 10;
      
      // Check if near the border (for unfilled shapes)
      const nearLeft = Math.abs(x - shapeX) < threshold && y >= shapeY - threshold && y <= shapeY + height + threshold;
      const nearRight = Math.abs(x - (shapeX + width)) < threshold && y >= shapeY - threshold && y <= shapeY + height + threshold;
      const nearTop = Math.abs(y - shapeY) < threshold && x >= shapeX - threshold && x <= shapeX + width + threshold;
      const nearBottom = Math.abs(y - (shapeY + height)) < threshold && x >= shapeX - threshold && x <= shapeX + width + threshold;
      
      if (obj.type === 'ellipse') {
        // For ellipse, check if point is near the ellipse border
        const centerX = shapeX + width / 2;
        const centerY = shapeY + height / 2;
        const a = width / 2;
        const b = height / 2;
        const normalizedX = (x - centerX) / a;
        const normalizedY = (y - centerY) / b;
        const distance = normalizedX * normalizedX + normalizedY * normalizedY;
        return Math.abs(distance - 1) < 0.3 || (obj.fill && distance <= 1);
      }
      
      return nearLeft || nearRight || nearTop || nearBottom || 
             (obj.fill && x >= shapeX && x <= shapeX + width && y >= shapeY && y <= shapeY + height);
    }
    
    return false;
  };

  const isPointInLine = (x, y, obj, threshold = 10) => {
    // Check if point is near the line segment
    const { x1, y1, x2, y2 } = obj;
    const lineLength = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
    if (lineLength === 0) return Math.sqrt((x - x1) ** 2 + (y - y1) ** 2) < threshold;
    
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / (lineLength ** 2)));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    const distance = Math.sqrt((x - projX) ** 2 + (y - projY) ** 2);
    
    return distance < threshold;
  };

  const isPointInResizeHandle = (x, y, obj) => {
    const result = getResizeHandleAtPoint(x, y, obj);
    return result ? result.handle : null;
  };

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;

    // PAN MODE: Middle mouse button or Space + Left click
    if (nativeEvent.button === 1 || (tool === "pan" && nativeEvent.button === 0)) {
      setIsPanning(true);
      setPanStart({ x: offsetX, y: offsetY });
      return;
    }

    // Convert screen coordinates to canvas coordinates
    const canvasCoords = screenToCanvas(offsetX, offsetY);
    const canvasX = canvasCoords.x;
    const canvasY = canvasCoords.y;

    if (tool === "select") {
      // First check if clicking on a resize handle of selected object
      if (selectedObject !== null && objects[selectedObject] && !objects[selectedObject].deleted) {
        const obj = objects[selectedObject];
        const handle = isPointInResizeHandle(canvasX, canvasY, obj);
        if (handle) {
          setIsResizing(true);
          setResizeHandle(handle);
          const bounds = getObjectBounds(obj);
          setResizeStartData({
            x: canvasX,
            y: canvasY,
            startX: offsetX,
            startY: offsetY,
            bounds: bounds,
            objectIndex: selectedObject,
            originalObject: JSON.parse(JSON.stringify(obj)) // Deep copy the original object
          });
          return;
        }
      }

      // Check if clicking on an object
      let clickedIndex = -1;
      for (let i = objects.length - 1; i >= 0; i--) {
        const obj = objects[i];
        if (obj.deleted) continue;
        if (obj.type === 'stroke' && isPointInStroke(canvasX, canvasY, obj.points)) {
          clickedIndex = i;
          break;
        } else if (obj.type === 'text' && isPointInText(canvasX, canvasY, obj)) {
          clickedIndex = i;
          break;
        } else if ((obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') && isPointInShape(canvasX, canvasY, obj)) {
          clickedIndex = i;
          break;
        } else if ((obj.type === 'line' || obj.type === 'arrow') && isPointInLine(canvasX, canvasY, obj)) {
          clickedIndex = i;
          break;
        }
      }

      if (clickedIndex !== -1) {
        setSelectedObject(clickedIndex);
        setSelectedStickyNote(null); // Deselect sticky note when selecting canvas object
        setIsDragging(true);
        setDragOffset({ x: canvasX, y: canvasY });
      } else {
        setSelectedObject(null);
        setSelectedStickyNote(null); // Deselect sticky note when clicking empty canvas
      }
      return;
    }

    // Shape tools
    const shapeTools = ['rectangle', 'ellipse', 'triangle', 'line', 'arrow'];
    if (shapeTools.includes(tool)) {
      setIsDrawingShape(true);
      setShapeStart({ x: canvasX, y: canvasY });
      
      if (tool === 'line' || tool === 'arrow') {
        setLiveShape({
          type: tool,
          x1: canvasX,
          y1: canvasY,
          x2: canvasX,
          y2: canvasY,
          color,
          size
        });
      } else {
        setLiveShape({
          type: tool,
          x: canvasX,
          y: canvasY,
          width: 0,
          height: 0,
          color,
          size
        });
      }
      return;
    }

    const ctx = ctxRef.current;
    if (tool === "erase") {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = size * 4;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
    }
    ctx.beginPath();
    ctx.moveTo(canvasX, canvasY);
    setIsDrawing(true);
    currentStroke.current = [{ x: canvasX, y: canvasY }];

    // Initialize live stroke
    setLiveStroke({
      points: [{ x: canvasX, y: canvasY }],
      color,
      size,
      tool
    });

    // Emit start of stroke
    socket.emit("draw", {
      roomId,
      socketId: socket.id,
      x: canvasX,
      y: canvasY,
      color,
      size,
      tool,
      isStart: true
    });
  };

  const draw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;

    // Handle panning
    if (isPanning) {
      const deltaX = offsetX - panStart.x;
      const deltaY = offsetY - panStart.y;

      setViewportTransform(prev => ({
        ...prev,
        translateX: prev.translateX + deltaX,
        translateY: prev.translateY + deltaY
      }));

      setPanStart({ x: offsetX, y: offsetY });
      return;
    }

    // Convert screen coordinates to canvas coordinates
    const canvasCoords = screenToCanvas(offsetX, offsetY);
    const canvasX = canvasCoords.x;
    const canvasY = canvasCoords.y;

    // Emit cursor position (throttled) - use Supabase Presence if available
    if (!cursorThrottleRef.current) {
      cursorThrottleRef.current = setTimeout(() => {
        if (onCursorMove) {
          // Use Supabase Presence
          onCursorMove(canvasX, canvasY);
        } else {
          // Fallback to Socket.IO
          socket.emit("cursor:move", {
            roomId,
            x: canvasX,
            y: canvasY
          });
        }
        cursorThrottleRef.current = null;
      }, 50); // Throttle to 20fps for cursor updates
    }

    // Update cursor for resize handles when in select mode
    if (tool === "select" && !isResizing && !isDragging) {
      let newCursor = 'default';
      
      // Check if hovering over a resize handle of selected object
      if (selectedObject !== null && objects[selectedObject] && !objects[selectedObject].deleted) {
        const handleResult = getResizeHandleAtPoint(canvasX, canvasY, objects[selectedObject]);
        if (handleResult) {
          newCursor = handleResult.cursor;
        } else {
          // Check if hovering over the object itself
          const obj = objects[selectedObject];
          if ((obj.type === 'stroke' && isPointInStroke(canvasX, canvasY, obj.points)) ||
              (obj.type === 'text' && isPointInText(canvasX, canvasY, obj)) ||
              ((obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') && isPointInShape(canvasX, canvasY, obj)) ||
              ((obj.type === 'line' || obj.type === 'arrow') && isPointInLine(canvasX, canvasY, obj))) {
            newCursor = 'move';
          }
        }
      }
      
      // Check if hovering over any object
      if (newCursor === 'default') {
        for (let i = objects.length - 1; i >= 0; i--) {
          const obj = objects[i];
          if (obj.deleted) continue;
          if ((obj.type === 'stroke' && isPointInStroke(canvasX, canvasY, obj.points)) ||
              (obj.type === 'text' && isPointInText(canvasX, canvasY, obj)) ||
              ((obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') && isPointInShape(canvasX, canvasY, obj)) ||
              ((obj.type === 'line' || obj.type === 'arrow') && isPointInLine(canvasX, canvasY, obj))) {
            newCursor = 'pointer';
            break;
          }
        }
      }
      
      setCursorStyle(newCursor);
    }

    // Handle shape drawing
    if (isDrawingShape && shapeStart) {
      if (liveShape.type === 'line' || liveShape.type === 'arrow') {
        setLiveShape(prev => ({
          ...prev,
          x2: canvasX,
          y2: canvasY
        }));
      } else {
        // For rectangle, ellipse, triangle - support drawing in any direction
        const width = canvasX - shapeStart.x;
        const height = canvasY - shapeStart.y;
        
        setLiveShape(prev => ({
          ...prev,
          x: width >= 0 ? shapeStart.x : canvasX,
          y: height >= 0 ? shapeStart.y : canvasY,
          width: Math.abs(width),
          height: Math.abs(height)
        }));
      }
      return;
    }

    if (tool === "select" && isResizing && resizeStartData) {
      const obj = objects[resizeStartData.objectIndex];
      if (!obj) return;
      
      const deltaX = canvasX - resizeStartData.x;
      const deltaY = canvasY - resizeStartData.y;
      const originalObj = resizeStartData.originalObject;
      const bounds = resizeStartData.bounds;
      
      if (obj.type === 'text') {
        // For text, resize by changing font size based on diagonal movement
        const handle = resizeHandle;
        let scaleFactorX = 1;
        let scaleFactorY = 1;
        
        if (handle.includes('e')) scaleFactorX = (bounds.width + deltaX) / bounds.width;
        if (handle.includes('w')) scaleFactorX = (bounds.width - deltaX) / bounds.width;
        if (handle.includes('s')) scaleFactorY = (bounds.height + deltaY) / bounds.height;
        if (handle.includes('n')) scaleFactorY = (bounds.height - deltaY) / bounds.height;
        
        const scaleFactor = Math.max(scaleFactorX, scaleFactorY);
        const originalFontSize = originalObj.fontSize || 20;
        const newFontSize = Math.max(8, Math.min(200, originalFontSize * scaleFactor));

        setObjects(prev => {
          const updated = [...prev];
          if (updated[resizeStartData.objectIndex]) {
            updated[resizeStartData.objectIndex] = {
              ...updated[resizeStartData.objectIndex],
              fontSize: newFontSize
            };
          }
          return updated;
        });
      } else if (obj.type === 'stroke') {
        // For strokes, scale all points relative to the anchor point
        const originalPoints = originalObj.points;
        const originalBounds = getStrokeBounds(originalPoints);
        
        // Determine anchor point based on resize handle (opposite corner/edge)
        let anchorX, anchorY;
        let scaleX = 1, scaleY = 1;
        
        const handle = resizeHandle;
        
        // Set anchor point (opposite to the handle being dragged)
        if (handle.includes('n')) {
          anchorY = originalBounds.maxY;
          const newHeight = originalBounds.height - deltaY;
          scaleY = newHeight / Math.max(originalBounds.height, 1);
        } else if (handle.includes('s')) {
          anchorY = originalBounds.minY;
          const newHeight = originalBounds.height + deltaY;
          scaleY = newHeight / Math.max(originalBounds.height, 1);
        } else {
          anchorY = originalBounds.minY + originalBounds.height / 2;
        }
        
        if (handle.includes('w')) {
          anchorX = originalBounds.maxX;
          const newWidth = originalBounds.width - deltaX;
          scaleX = newWidth / Math.max(originalBounds.width, 1);
        } else if (handle.includes('e')) {
          anchorX = originalBounds.minX;
          const newWidth = originalBounds.width + deltaX;
          scaleX = newWidth / Math.max(originalBounds.width, 1);
        } else {
          anchorX = originalBounds.minX + originalBounds.width / 2;
        }
        
        // Limit scale factors
        scaleX = Math.max(0.1, Math.min(10, scaleX));
        scaleY = Math.max(0.1, Math.min(10, scaleY));
        
        // Scale all points
        const newPoints = originalPoints.map(p => ({
          x: anchorX + (p.x - anchorX) * scaleX,
          y: anchorY + (p.y - anchorY) * scaleY
        }));

        setObjects(prev => {
          const updated = [...prev];
          if (updated[resizeStartData.objectIndex]) {
            updated[resizeStartData.objectIndex] = {
              ...updated[resizeStartData.objectIndex],
              points: newPoints
            };
          }
          return updated;
        });
      } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
        // For shapes, resize by changing dimensions
        const handle = resizeHandle;
        let newX = originalObj.x;
        let newY = originalObj.y;
        let newWidth = originalObj.width;
        let newHeight = originalObj.height;
        
        if (handle.includes('e')) newWidth = originalObj.width + deltaX;
        if (handle.includes('w')) {
          newX = originalObj.x + deltaX;
          newWidth = originalObj.width - deltaX;
        }
        if (handle.includes('s')) newHeight = originalObj.height + deltaY;
        if (handle.includes('n')) {
          newY = originalObj.y + deltaY;
          newHeight = originalObj.height - deltaY;
        }
        
        setObjects(prev => {
          const updated = [...prev];
          if (updated[resizeStartData.objectIndex]) {
            updated[resizeStartData.objectIndex] = {
              ...updated[resizeStartData.objectIndex],
              x: newX,
              y: newY,
              width: newWidth,
              height: newHeight
            };
          }
          return updated;
        });
      } else if (obj.type === 'line' || obj.type === 'arrow') {
        // For lines/arrows, move endpoints
        const handle = resizeHandle;
        let newX1 = originalObj.x1;
        let newY1 = originalObj.y1;
        let newX2 = originalObj.x2;
        let newY2 = originalObj.y2;
        
        // Determine which endpoint to move based on handle
        if (handle === 'nw' || handle === 'w' || handle === 'sw') {
          if (originalObj.x1 <= originalObj.x2) {
            newX1 = originalObj.x1 + deltaX;
          } else {
            newX2 = originalObj.x2 + deltaX;
          }
        }
        if (handle === 'ne' || handle === 'e' || handle === 'se') {
          if (originalObj.x2 >= originalObj.x1) {
            newX2 = originalObj.x2 + deltaX;
          } else {
            newX1 = originalObj.x1 + deltaX;
          }
        }
        if (handle === 'nw' || handle === 'n' || handle === 'ne') {
          if (originalObj.y1 <= originalObj.y2) {
            newY1 = originalObj.y1 + deltaY;
          } else {
            newY2 = originalObj.y2 + deltaY;
          }
        }
        if (handle === 'sw' || handle === 's' || handle === 'se') {
          if (originalObj.y2 >= originalObj.y1) {
            newY2 = originalObj.y2 + deltaY;
          } else {
            newY1 = originalObj.y1 + deltaY;
          }
        }
        
        setObjects(prev => {
          const updated = [...prev];
          if (updated[resizeStartData.objectIndex]) {
            updated[resizeStartData.objectIndex] = {
              ...updated[resizeStartData.objectIndex],
              x1: newX1,
              y1: newY1,
              x2: newX2,
              y2: newY2
            };
          }
          return updated;
        });
      }
      return;
    }

    if (tool === "select" && isDragging && selectedObject !== null) {
      const deltaX = canvasX - dragOffset.x;
      const deltaY = canvasY - dragOffset.y;

      setObjects(prev => {
        const updated = [...prev];
        const obj = updated[selectedObject];
        if (obj.type === 'stroke') {
          updated[selectedObject] = {
            ...obj,
            points: obj.points.map(p => ({ x: p.x + deltaX, y: p.y + deltaY }))
          };
        } else if (obj.type === 'text') {
          updated[selectedObject] = {
            ...obj,
            x: obj.x + deltaX,
            y: obj.y + deltaY
          };
        } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
          updated[selectedObject] = {
            ...obj,
            x: obj.x + deltaX,
            y: obj.y + deltaY
          };
        } else if (obj.type === 'line' || obj.type === 'arrow') {
          updated[selectedObject] = {
            ...obj,
            x1: obj.x1 + deltaX,
            y1: obj.y1 + deltaY,
            x2: obj.x2 + deltaX,
            y2: obj.y2 + deltaY
          };
        }
        return updated;
      });

      socket.emit("move", { roomId, index: selectedObject, deltaX, deltaY });
      setDragOffset({ x: canvasX, y: canvasY });
      return;
    }

    if (!isDrawing) return;
    currentStroke.current.push({ x: canvasX, y: canvasY });

    // Update live stroke for rendering
    setLiveStroke({
      points: [...currentStroke.current],
      color,
      size,
      tool
    });

    socket.emit("draw", {
      roomId,
      socketId: socket.id,
      x: canvasX,
      y: canvasY,
      color,
      size,
      tool,
      isStart: false
    });
  };

  const stopDrawing = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    // Handle shape drawing completion
    if (isDrawingShape && liveShape) {
      // Only create shape if it has meaningful size
      const hasSize = liveShape.type === 'line' || liveShape.type === 'arrow' 
        ? (Math.abs(liveShape.x2 - liveShape.x1) > 5 || Math.abs(liveShape.y2 - liveShape.y1) > 5)
        : (Math.abs(liveShape.width) > 5 || Math.abs(liveShape.height) > 5);
      
      if (hasSize) {
        const newShape = { ...liveShape };
        setObjects(prev => [...prev, newShape]);
        socket.emit("shape", { roomId, ...newShape });
        saveState();
      }
      
      setIsDrawingShape(false);
      setShapeStart(null);
      setLiveShape(null);
      return;
    }

    if (tool === "select") {
      if (isResizing) {
        // Emit final resize event when resize completes
        if (resizeStartData && objects[resizeStartData.objectIndex]) {
          const obj = objects[resizeStartData.objectIndex];
          if (obj.type === 'text') {
            const finalFontSize = obj.fontSize;
            socket.emit("resize", { roomId, index: resizeStartData.objectIndex, fontSize: finalFontSize });
          } else if (obj.type === 'stroke') {
            // Emit stroke resize with new points
            socket.emit("resizeStroke", { roomId, index: resizeStartData.objectIndex, points: obj.points });
          } else if (obj.type === 'rectangle' || obj.type === 'ellipse' || obj.type === 'triangle') {
            socket.emit("resizeShape", { 
              roomId, 
              index: resizeStartData.objectIndex, 
              x: obj.x, 
              y: obj.y, 
              width: obj.width, 
              height: obj.height 
            });
          } else if (obj.type === 'line' || obj.type === 'arrow') {
            socket.emit("resizeLine", { 
              roomId, 
              index: resizeStartData.objectIndex, 
              x1: obj.x1, 
              y1: obj.y1, 
              x2: obj.x2, 
              y2: obj.y2 
            });
          }
        }

        setIsResizing(false);
        setResizeHandle(null);
        setResizeStartData(null);
        saveState();
        return;
      }

      setIsDragging(false);
      if (selectedObject !== null) {
        saveState();
      }
      return;
    }

    // Don't process stroke if we were drawing a shape
    const shapeTools = ['rectangle', 'ellipse', 'triangle', 'line', 'arrow'];
    if (shapeTools.includes(tool)) {
      return;
    }

    ctxRef.current.closePath();
    setIsDrawing(false);

    // Save the stroke as an object
    if (currentStroke.current.length > 0) {
      const newStroke = {
        type: 'stroke',
        points: [...currentStroke.current],
        color,
        size,
        tool
      };
      setObjects(prev => [...prev, newStroke]);
      socket.emit("stroke", { roomId, socketId: socket.id, ...newStroke });
      currentStroke.current = [];
    }

    // Clear live stroke
    setLiveStroke(null);

    saveState(); // Save state after each stroke
  };

  const handleCanvasClick = (e) => {
    if (tool === "text") {
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasCoords = screenToCanvas(screenX, screenY);

      setTextInput({ x: canvasCoords.x, y: canvasCoords.y });
      setInputValue("");
      return;
    }

    if (tool === "stickyNote") {
      const rect = canvasRef.current.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const canvasCoords = screenToCanvas(screenX, screenY);

      const newNote = {
        id: Date.now().toString() + Math.random().toString(36),
        x: canvasCoords.x,
        y: canvasCoords.y,
        width: 200,
        height: 200,
        text: "Double-click to edit",
        color: "#ffd700", // Yellow sticky note
        zIndex: stickyNotes.length
      };

      setStickyNotes(prev => [...prev, newNote]);
      socket.emit("stickyNote:create", { roomId, ...newNote });
      return;
    }
  }; const handleTextSubmit = (e) => {
    if (e.key === "Enter" && inputValue.trim()) {
      const newText = { type: 'text', text: inputValue, x: textInput.x, y: textInput.y, color, fontSize: 20 };

      setTexts((prev) => [...prev, newText]);
      setObjects(prev => [...prev, newText]);
      socket.emit("text", { roomId, ...newText });
      saveState();

      setTextInput(null);
      setInputValue("");
    } else if (e.key === "Escape") {
      setTextInput(null);
      setInputValue("");
    }
  };

  const handleStickyNoteMouseDown = (e, noteId, isResizeHandle = false, handle = null) => {
    // Prevent default to avoid triggering contentEditable on single click
    if (e.detail !== 2) { // Not a double click
      e.preventDefault();
      e.stopPropagation();

      const note = stickyNotes.find(n => n.id === noteId);
      if (!note) return;

      setSelectedStickyNote(noteId);

      if (isResizeHandle && handle) {
        // Start resizing
        setResizingStickyNote(noteId);
        setStickyNoteResizeHandle(handle);
        setStickyNoteResizeStart({
          x: e.clientX,
          y: e.clientY,
          width: note.width,
          height: note.height,
          noteX: note.x,
          noteY: note.y
        });
      } else {
        // Start dragging
        setDraggingStickyNote(noteId);
        setStickyNoteDragOffset({
          x: e.clientX - note.x,
          y: e.clientY - note.y
        });
      }
    }
  };

  const handleStickyNoteMouseMove = (e) => {
    if (resizingStickyNote && stickyNoteResizeStart) {
      e.preventDefault();
      const deltaX = e.clientX - stickyNoteResizeStart.x;
      const deltaY = e.clientY - stickyNoteResizeStart.y;
      const handle = stickyNoteResizeHandle;
      
      setStickyNotes(prev => prev.map(note => {
        if (note.id !== resizingStickyNote) return note;
        
        let newX = stickyNoteResizeStart.noteX;
        let newY = stickyNoteResizeStart.noteY;
        let newWidth = stickyNoteResizeStart.width;
        let newHeight = stickyNoteResizeStart.height;
        
        // Handle different resize directions
        if (handle.includes('e')) {
          newWidth = Math.max(100, stickyNoteResizeStart.width + deltaX);
        }
        if (handle.includes('w')) {
          const widthChange = Math.min(deltaX, stickyNoteResizeStart.width - 100);
          newWidth = Math.max(100, stickyNoteResizeStart.width - deltaX);
          newX = stickyNoteResizeStart.noteX + widthChange;
        }
        if (handle.includes('s')) {
          newHeight = Math.max(100, stickyNoteResizeStart.height + deltaY);
        }
        if (handle.includes('n')) {
          const heightChange = Math.min(deltaY, stickyNoteResizeStart.height - 100);
          newHeight = Math.max(100, stickyNoteResizeStart.height - deltaY);
          newY = stickyNoteResizeStart.noteY + heightChange;
        }
        
        return { ...note, x: newX, y: newY, width: newWidth, height: newHeight };
      }));
    } else if (draggingStickyNote) {
      e.preventDefault();
      const newX = e.clientX - stickyNoteDragOffset.x;
      const newY = e.clientY - stickyNoteDragOffset.y;

      setStickyNotes(prev => prev.map(note =>
        note.id === draggingStickyNote
          ? { ...note, x: newX, y: newY }
          : note
      ));
    }
  };

  const handleStickyNoteMouseUp = () => {
    if (resizingStickyNote) {
      const note = stickyNotes.find(n => n.id === resizingStickyNote);
      if (note) {
        socket.emit("stickyNote:resize", { roomId, id: note.id, x: note.x, y: note.y, width: note.width, height: note.height });
      }
      setResizingStickyNote(null);
      setStickyNoteResizeHandle(null);
      setStickyNoteResizeStart(null);
    } else if (draggingStickyNote) {
      const note = stickyNotes.find(n => n.id === draggingStickyNote);
      if (note) {
        socket.emit("stickyNote:move", { roomId, id: note.id, x: note.x, y: note.y });
      }
      setDraggingStickyNote(null);
    }
  };

  // Redraw canvas whenever objects change
  useEffect(() => {
    redrawCanvas();
  }, [objects, selectedObject, liveStroke, liveShape, viewportTransform]);

  // Notify parent of zoom changes
  useEffect(() => {
    if (onZoomChange) {
      onZoomChange(viewportTransform.scale);
    }
  }, [viewportTransform.scale, onZoomChange]);

  const deleteSelectedObject = () => {
    if (selectedObject !== null) {
      setObjects(prev => {
        const updated = [...prev];
        if (updated[selectedObject]) {
          updated[selectedObject] = { ...updated[selectedObject], deleted: true };
        }
        return updated;
      });
      socket.emit("delete", { roomId, index: selectedObject });
      setSelectedObject(null);
      saveState();
    }
  };

  const deleteSelectedStickyNote = () => {
    if (selectedStickyNote !== null) {
      setStickyNotes(prev => prev.filter(n => n.id !== selectedStickyNote));
      socket.emit("stickyNote:delete", { roomId, id: selectedStickyNote });
      setSelectedStickyNote(null);
    }
  };

  // Expose undo/redo functions to parent via ref
  useImperativeHandle(ref, () => ({
    undo,
    redo,
    deleteSelectedObject: () => {
      if (selectedObject !== null) {
        deleteSelectedObject();
      } else if (selectedStickyNote !== null) {
        deleteSelectedStickyNote();
      }
    }
  }));

  const handleCanvasMouseLeave = () => {
    if (onCursorLeave) {
      onCursorLeave();
    } else if (socket) {
      socket.emit("cursor:leave", { roomId });
    }
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={handleCanvasMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        className="border w-full h-full"
        style={{ 
          cursor: tool === 'select' ? cursorStyle : 
                  tool === 'pan' ? (isPanning ? 'grabbing' : 'grab') : 
                  tool === 'text' ? 'text' : 
                  'crosshair',
          touchAction: 'none' // Prevent default touch behaviors like scrolling
        }}
      />
      {textInput && (() => {
        const screenPos = canvasToScreen(textInput.x, textInput.y);
        return (
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleTextSubmit}
            autoFocus
            style={{
              position: "absolute",
              left: `${screenPos.x}px`,
              top: `${screenPos.y - 25}px`,
              fontSize: "20px",
              fontFamily: "Arial",
              color: color,
              background: "transparent",
              border: "2px dashed #999",
              outline: "none",
              padding: "2px 5px",
              zIndex: 1000,
            }}
            placeholder="Type text (Enter to submit, Esc to cancel)"
          />
        );
      })()}
      {stickyNotes.map((note) => {
        const screenPos = canvasToScreen(note.x, note.y);
        const isSelected = selectedStickyNote === note.id;
        const scaledWidth = note.width * viewportTransform.scale;
        const scaledHeight = note.height * viewportTransform.scale;
        
        // Touch-friendly handle size (larger for mobile)
        const handleSize = 16; // Larger for touch
        const handleOffset = -handleSize / 2;
        
        return (
          <div
            key={note.id}
            style={{
              position: "absolute",
              left: `${screenPos.x}px`,
              top: `${screenPos.y}px`,
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`,
              backgroundColor: note.color,
              border: isSelected ? "2px solid #0066ff" : "1px solid #ccc",
              borderRadius: "4px",
              boxShadow: isSelected ? "0 0 0 2px rgba(0, 102, 255, 0.2), 2px 2px 8px rgba(0,0,0,0.2)" : "2px 2px 8px rgba(0,0,0,0.2)",
              zIndex: 1000 + note.zIndex,
              cursor: draggingStickyNote === note.id ? "grabbing" : "grab",
              padding: "10px",
              overflow: "auto",
              fontFamily: "Arial, sans-serif",
              fontSize: "14px",
              userSelect: "none",
              touchAction: "none"
            }}
            onMouseDown={(e) => handleStickyNoteMouseDown(e, note.id)}
            onTouchStart={(e) => handleStickyNoteTouchStart(e, note.id)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              e.currentTarget.querySelector('.sticky-note-content').contentEditable = "true";
              e.currentTarget.querySelector('.sticky-note-content').focus();
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedStickyNote(note.id);
              setSelectedObject(null);
            }}
          >
            {/* Resize handles - only show when selected (touch-friendly size) */}
            {isSelected && (
              <>
                {/* Corner handles - larger for touch */}
                <div 
                  style={{ position: 'absolute', top: handleOffset, left: handleOffset, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'nw-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'nw'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'nw'); }}
                />
                <div 
                  style={{ position: 'absolute', top: handleOffset, right: handleOffset, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'ne-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'ne'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'ne'); }}
                />
                <div 
                  style={{ position: 'absolute', bottom: handleOffset, left: handleOffset, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'sw-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'sw'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'sw'); }}
                />
                <div 
                  style={{ position: 'absolute', bottom: handleOffset, right: handleOffset, width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'se-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'se'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'se'); }}
                />
                {/* Edge handles - larger for touch */}
                <div 
                  style={{ position: 'absolute', top: handleOffset, left: '50%', transform: 'translateX(-50%)', width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'n-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'n'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'n'); }}
                />
                <div 
                  style={{ position: 'absolute', bottom: handleOffset, left: '50%', transform: 'translateX(-50%)', width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 's-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 's'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 's'); }}
                />
                <div 
                  style={{ position: 'absolute', left: handleOffset, top: '50%', transform: 'translateY(-50%)', width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'w-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'w'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'w'); }}
                />
                <div 
                  style={{ position: 'absolute', right: handleOffset, top: '50%', transform: 'translateY(-50%)', width: handleSize, height: handleSize, backgroundColor: '#fff', border: '2px solid #0066ff', borderRadius: '50%', cursor: 'e-resize', zIndex: 20, touchAction: 'none' }}
                  onMouseDown={(e) => { e.stopPropagation(); handleStickyNoteMouseDown(e, note.id, true, 'e'); }}
                  onTouchStart={(e) => { e.stopPropagation(); handleStickyNoteTouchStart(e, note.id, true, 'e'); }}
                />
              </>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setStickyNotes(prev => prev.filter(n => n.id !== note.id));
                socket.emit("stickyNote:delete", { roomId, id: note.id });
              }}
              style={{
                position: 'absolute',
                top: '5px',
                right: '5px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
                color: '#000',
                opacity: 0.3,
                padding: '0 4px',
                zIndex: 10
              }}
              title="Delete Note"
              onMouseEnter={(e) => e.target.style.opacity = 1}
              onMouseLeave={(e) => e.target.style.opacity = 0.3}
            >
              ✕
            </button>
            <div
              className="sticky-note-content"
              onBlur={(e) => {
                e.currentTarget.contentEditable = "false";
                const newText = e.currentTarget.innerText;
                setStickyNotes(prev => prev.map(n =>
                  n.id === note.id ? { ...n, text: newText } : n
                ));
                socket.emit("stickyNote:update", { roomId, id: note.id, text: newText });
              }}
              suppressContentEditableWarning={true}
            >
              {note.text}
            </div>
          </div>
        );
      })}
      
      {/* Remote collaborator cursors */}
      {Object.entries(remoteCursors).map(([odId, cursor]) => {
        const screenPos = canvasToScreen(cursor.x, cursor.y);
        return (
          <div
            key={odId}
            style={{
              position: 'absolute',
              left: `${screenPos.x}px`,
              top: `${screenPos.y}px`,
              pointerEvents: 'none',
              zIndex: 9999,
              transition: 'left 0.05s linear, top 0.05s linear'
            }}
          >
            {/* Cursor arrow SVG */}
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              style={{
                filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.3))'
              }}
            >
              <path
                d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87c.48 0 .72-.58.38-.92L6.35 2.85a.5.5 0 0 0-.85.36Z"
                fill={cursor.userColor || '#6366f1'}
                stroke="#fff"
                strokeWidth="1.5"
              />
            </svg>
            {/* User name label */}
            <div
              style={{
                position: 'absolute',
                left: '16px',
                top: '16px',
                backgroundColor: cursor.userColor || '#6366f1',
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
              }}
            >
              {cursor.userName || `User ${odId.slice(-4)}`}
            </div>
          </div>
        );
      })}
    </>
  );
});

export default Whiteboard;
