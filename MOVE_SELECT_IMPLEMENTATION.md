# Move/Select Feature Implementation Guide

## Overview
This document explains how the Move/Select feature was implemented in the collaborative whiteboard application.

## Architecture Changes

### 1. **Object-Based Drawing Model**

**Before:** The canvas used immediate-mode rendering where strokes were drawn directly to the canvas and couldn't be manipulated afterwards.

**After:** Implemented a **retained-mode model** where each drawing element (stroke or text) is stored as an object.

```javascript
// New state to store all drawable objects
const [objects, setObjects] = useState([]);

// Object structure for strokes
{
  type: 'stroke',
  points: [{ x: 100, y: 200 }, { x: 101, y: 201 }, ...],
  color: '#000000',
  size: 4,
  tool: 'pen' // or 'erase'
}

// Object structure for text
{
  type: 'text',
  text: 'Hello',
  x: 150,
  y: 200,
  color: '#000000'
}
```

**Why this matters:** By storing objects in an array, we can:
- Select individual elements
- Move/transform them
- Redraw the entire canvas from scratch
- Implement undo/redo properly

---

### 2. **Selection State Management**

Added three new state variables to track selection and dragging:

```javascript
const [selectedObject, setSelectedObject] = useState(null);  // Index of selected object
const [isDragging, setIsDragging] = useState(false);         // Whether user is dragging
const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Last mouse position for delta calculation
```

---

### 3. **Redraw Canvas Function**

Created `redrawCanvas()` to re-render all objects whenever the state changes:

```javascript
const redrawCanvas = () => {
  const canvas = canvasRef.current;
  const ctx = ctxRef.current;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Redraw all objects
  objects.forEach((obj) => {
    if (obj.type === 'stroke') {
      // Set context properties based on object data
      ctx.globalCompositeOperation = obj.tool === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = obj.color;
      ctx.lineWidth = obj.tool === 'erase' ? obj.size * 4 : obj.size;
      
      // Draw the stroke by replaying all points
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
      // Draw text objects
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = obj.color;
      ctx.font = "20px Arial";
      ctx.fillText(obj.text, obj.x, obj.y);
    }
  });
  
  // Highlight selected object with dashed blue border
  if (selectedObject !== null && objects[selectedObject]) {
    const obj = objects[selectedObject];
    ctx.strokeStyle = '#00f';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed line
    
    if (obj.type === 'stroke') {
      const bounds = getStrokeBounds(obj.points);
      ctx.strokeRect(bounds.minX - 5, bounds.minY - 5, 
                     bounds.maxX - bounds.minX + 10, 
                     bounds.maxY - bounds.minY + 10);
    } else if (obj.type === 'text') {
      ctx.strokeRect(obj.x - 5, obj.y - 25, 100, 30);
    }
    ctx.setLineDash([]); // Reset to solid line
  }
};
```

**Key Point:** This function is called via `useEffect` whenever `objects` or `selectedObject` changes, ensuring the canvas always reflects the current state.

---

### 4. **Hit Testing (Click Detection)**

Implemented functions to detect if a click hits an object:

```javascript
// For strokes: check if click is within threshold distance of any point
const isPointInStroke = (x, y, points, threshold = 10) => {
  return points.some(point => {
    const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
    return distance < threshold;
  });
};

// For text: check if click is within rectangular bounds
const isPointInText = (x, y, textObj) => {
  const textWidth = 100;  // Approximate width
  const textHeight = 25;
  return x >= textObj.x - 5 && x <= textObj.x + textWidth &&
         y >= textObj.y - textHeight && y <= textObj.y + 5;
};
```

**Why threshold matters:** Strokes are lines, not filled shapes. The 10-pixel threshold makes them easier to click.

---

### 5. **Modified Mouse Event Handlers**

#### `startDrawing()` - Now handles both drawing and selection

```javascript
const startDrawing = ({ nativeEvent }) => {
  const { offsetX, offsetY } = nativeEvent;
  
  // SELECT MODE: Check if clicking on an object
  if (tool === "select") {
    let clickedIndex = -1;
    
    // Loop backwards through objects (top to bottom rendering order)
    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'stroke' && isPointInStroke(offsetX, offsetY, obj.points)) {
        clickedIndex = i;
        break; // Select the topmost matching object
      } else if (obj.type === 'text' && isPointInText(offsetX, offsetY, obj)) {
        clickedIndex = i;
        break;
      }
    }
    
    if (clickedIndex !== -1) {
      setSelectedObject(clickedIndex);
      setIsDragging(true);
      setDragOffset({ x: offsetX, y: offsetY }); // Store initial position
    } else {
      setSelectedObject(null); // Deselect if clicking empty space
    }
    return;
  }
  
  // DRAWING MODE: Original pen/eraser logic
  const ctx = ctxRef.current;
  // ... configure context ...
  ctx.beginPath();
  ctx.moveTo(offsetX, offsetY);
  setIsDrawing(true);
  currentStroke.current = [{ x: offsetX, y: offsetY }]; // Start recording points
};
```

**Key Technique:** Loop backwards through the array so the most recently drawn (topmost) object is selected first.

---

#### `draw()` - Now handles dragging selected objects

```javascript
const draw = ({ nativeEvent }) => {
  const { offsetX, offsetY } = nativeEvent;
  
  // DRAG MODE: Move the selected object
  if (tool === "select" && isDragging && selectedObject !== null) {
    const deltaX = offsetX - dragOffset.x;  // Calculate movement delta
    const deltaY = offsetY - dragOffset.y;
    
    setObjects(prev => {
      const updated = [...prev];
      if (updated[selectedObject].type === 'stroke') {
        // Move all points in the stroke
        updated[selectedObject] = {
          ...updated[selectedObject],
          points: updated[selectedObject].points.map(p => ({ 
            x: p.x + deltaX, 
            y: p.y + deltaY 
          }))
        };
      } else if (updated[selectedObject].type === 'text') {
        // Move text position
        updated[selectedObject] = {
          ...updated[selectedObject],
          x: updated[selectedObject].x + deltaX,
          y: updated[selectedObject].y + deltaY
        };
      }
      return updated;
    });
    
    // Broadcast the move to other clients
    socket.emit("move", { index: selectedObject, deltaX, deltaY });
    
    // Update drag offset for next frame
    setDragOffset({ x: offsetX, y: offsetY });
    return;
  }
  
  // DRAWING MODE: Original drawing logic
  if (!isDrawing) return;
  ctxRef.current.lineTo(offsetX, offsetY);
  ctxRef.current.stroke();
  currentStroke.current.push({ x: offsetX, y: offsetY }); // Record point
  
  socket.emit("draw", { x: offsetX, y: offsetY, color, size, tool });
};
```

**Delta Movement:** Instead of using absolute positions, we calculate the difference (`deltaX`, `deltaY`) between frames. This allows smooth dragging regardless of where you grab the object.

---

#### `stopDrawing()` - Saves completed strokes as objects

```javascript
const stopDrawing = () => {
  if (tool === "select") {
    setIsDragging(false);
    if (selectedObject !== null) {
      saveState(); // Save to undo stack after moving
    }
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
    socket.emit("stroke", newStroke); // Send complete stroke to other clients
    currentStroke.current = [];
  }
  
  saveState();
};
```

**Important:** The `draw` event still fires during drawing for real-time collaboration, but the complete stroke is sent as a `stroke` event at the end. This ensures remote clients can both see live drawing AND store the object for selection.

---

### 6. **Socket.IO Communication**

Added two new events:

#### `stroke` event
Sends the complete stroke object when drawing finishes:
```javascript
socket.emit("stroke", {
  type: 'stroke',
  points: [...],
  color: '#000',
  size: 4,
  tool: 'pen'
});
```

#### `move` event
Broadcasts object movements:
```javascript
socket.emit("move", {
  index: 2,        // Which object in the array
  deltaX: 10,      // Movement in X
  deltaY: -5       // Movement in Y
});
```

**Server-side** (added to `server/index.js`):
```javascript
socket.on("stroke", (data) => {
  socket.broadcast.emit("stroke", data);
});

socket.on("move", (data) => {
  socket.broadcast.emit("move", data);
});
```

---

### 7. **Toolbar Update**

Added a Select button:
```javascript
<button onClick={() => setTool('select')} style={{ marginRight: '5px' }}>
  👆 Select
</button>
```

---

## How to Use

1. **Select the "Select" tool** from the toolbar (👆 Select button)
2. **Click on any drawn stroke or text** - it will be highlighted with a blue dashed box
3. **Drag to move** the selected object
4. **Click on empty space** to deselect

---

## Key Programming Concepts Used

### 1. **Immediate vs Retained Mode**
- **Immediate:** Draw directly to canvas, can't modify later (old approach)
- **Retained:** Store drawing data, redraw from scratch (new approach)

### 2. **Delta Movement**
Instead of setting absolute positions, we add deltas:
```javascript
newX = oldX + deltaX;
```
This works regardless of where you grab the object.

### 3. **Hit Testing**
Detecting if a click intersects with a shape using distance calculations and bounding boxes.

### 4. **Array Mutation in React**
Always create new arrays when updating state:
```javascript
setObjects(prev => [...prev, newObject]); // ✅ Correct
setObjects(prev => { prev.push(newObject); return prev; }); // ❌ Wrong
```

### 5. **Conditional Event Handlers**
The handlers now check the current tool and behave differently:
```javascript
if (tool === "select") {
  // Selection logic
} else {
  // Drawing logic
}
```

---

## Potential Enhancements

1. **Multi-select:** Hold Shift to select multiple objects
2. **Delete selected:** Press Delete key to remove selected object
3. **Copy/Paste:** Duplicate selected objects
4. **Resize handles:** Add corner handles to resize objects
5. **Object layering:** Move objects forward/backward in z-order
6. **Snap to grid:** Align objects to a grid when moving
7. **Better bounding boxes:** Calculate precise text width instead of using 100px

---

## Performance Considerations

- **Redrawing on every change** can be expensive for large canvases with many objects
- Future optimization: Use an **offscreen canvas** to cache the background layer
- Consider implementing **spatial indexing** (quadtree) for faster hit testing with thousands of objects

---

## Testing the Feature

1. Start the server: `cd server && node index.js`
2. Start the client: `npm start`
3. Draw some strokes and add text
4. Switch to Select tool
5. Click and drag objects around
6. Open in another browser tab to test real-time synchronization

---

Happy coding! 🚀
