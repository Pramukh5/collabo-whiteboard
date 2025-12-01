import { useState, useEffect } from 'react';
import {
  MousePointer2,
  Hand,
  Pen,
  Eraser,
  Type,
  StickyNote,
  Undo2,
  Redo2,
  Trash2,
  Square,
  Circle,
  Minus,
  ArrowRight,
  Triangle,
  ChevronDown,
  ChevronUp,
  Menu
} from 'lucide-react';

export default function Toolbar({ setColor, setSize, setTool, onUndo, onRedo, onDelete, zoom, activeTool }) {
  const [isMobile, setIsMobile] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showShapes, setShowShapes] = useState(false);

  // Detect mobile/tablet
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile-optimized toolbar
  if (isMobile) {
    return (
      <>
        {/* Mobile toolbar - bottom position */}
        <div className="toolbar-container toolbar-mobile">
          {/* Collapsed view toggle */}
          <button 
            className="tool-btn mobile-toggle"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? "Expand toolbar" : "Collapse toolbar"}
          >
            {isCollapsed ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
          </button>

          {!isCollapsed && (
            <>
              {/* Primary tools row */}
              <div className="toolbar-group mobile-group">
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'select' ? 'active' : ''}`}
                  onClick={() => setTool('select')}
                  aria-label="Select"
                >
                  <MousePointer2 size={24} />
                </button>
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'pan' ? 'active' : ''}`}
                  onClick={() => setTool('pan')}
                  aria-label="Pan"
                >
                  <Hand size={24} />
                </button>
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'pen' ? 'active' : ''}`}
                  onClick={() => setTool('pen')}
                  aria-label="Pen"
                >
                  <Pen size={24} />
                </button>
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'erase' ? 'active' : ''}`}
                  onClick={() => setTool('erase')}
                  aria-label="Eraser"
                >
                  <Eraser size={24} />
                </button>
              </div>

              {/* Secondary tools */}
              <div className="toolbar-group mobile-group">
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'text' ? 'active' : ''}`}
                  onClick={() => setTool('text')}
                  aria-label="Text"
                >
                  <Type size={24} />
                </button>
                <button 
                  className={`tool-btn mobile-btn ${activeTool === 'stickyNote' ? 'active' : ''}`}
                  onClick={() => setTool('stickyNote')}
                  aria-label="Sticky Note"
                >
                  <StickyNote size={24} />
                </button>
                {/* Shapes dropdown */}
                <div className="shapes-dropdown-container">
                  <button 
                    className={`tool-btn mobile-btn ${['rectangle', 'ellipse', 'triangle', 'line', 'arrow'].includes(activeTool) ? 'active' : ''}`}
                    onClick={() => setShowShapes(!showShapes)}
                    aria-label="Shapes"
                  >
                    <Square size={24} />
                  </button>
                  {showShapes && (
                    <div className="shapes-dropdown mobile-shapes-dropdown">
                      <button className="tool-btn mobile-btn" onClick={() => { setTool('rectangle'); setShowShapes(false); }}>
                        <Square size={24} />
                      </button>
                      <button className="tool-btn mobile-btn" onClick={() => { setTool('ellipse'); setShowShapes(false); }}>
                        <Circle size={24} />
                      </button>
                      <button className="tool-btn mobile-btn" onClick={() => { setTool('triangle'); setShowShapes(false); }}>
                        <Triangle size={24} />
                      </button>
                      <button className="tool-btn mobile-btn" onClick={() => { setTool('line'); setShowShapes(false); }}>
                        <Minus size={24} />
                      </button>
                      <button className="tool-btn mobile-btn" onClick={() => { setTool('arrow'); setShowShapes(false); }}>
                        <ArrowRight size={24} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Color and Size */}
              <div className="toolbar-group mobile-group">
                <div className="color-picker-wrapper mobile-color-picker">
                  <input
                    type="color"
                    className="color-picker"
                    onChange={(e) => setColor(e.target.value)}
                  />
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  defaultValue="4"
                  className="size-slider mobile-slider"
                  onChange={(e) => setSize(e.target.value)}
                  aria-label="Stroke Size"
                />
              </div>

              {/* Actions */}
              <div className="toolbar-group mobile-group">
                <button className="tool-btn mobile-btn" onClick={onDelete} aria-label="Delete">
                  <Trash2 size={24} />
                </button>
                <button className="tool-btn mobile-btn" onClick={onUndo} aria-label="Undo">
                  <Undo2 size={24} />
                </button>
                <button className="tool-btn mobile-btn" onClick={onRedo} aria-label="Redo">
                  <Redo2 size={24} />
                </button>
              </div>

              {/* Zoom display */}
              {zoom !== undefined && (
                <div className="toolbar-group mobile-group">
                  <span className="zoom-badge mobile-zoom">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </>
    );
  }

  // Desktop toolbar (original)
  return (
    <div className="toolbar-container">
      {/* Tools Group */}
      <div className="toolbar-group">
        <button className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`} onClick={() => setTool('select')} title="Select">
          <MousePointer2 size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'pan' ? 'active' : ''}`} onClick={() => setTool('pan')} title="Pan">
          <Hand size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`} onClick={() => setTool('pen')} title="Pen">
          <Pen size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'erase' ? 'active' : ''}`} onClick={() => setTool('erase')} title="Eraser">
          <Eraser size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'text' ? 'active' : ''}`} onClick={() => setTool('text')} title="Text">
          <Type size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'stickyNote' ? 'active' : ''}`} onClick={() => setTool('stickyNote')} title="Sticky Note">
          <StickyNote size={20} />
        </button>
      </div>

      {/* Shapes Group */}
      <div className="toolbar-group">
        <button className={`tool-btn ${activeTool === 'rectangle' ? 'active' : ''}`} onClick={() => setTool('rectangle')} title="Rectangle">
          <Square size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'ellipse' ? 'active' : ''}`} onClick={() => setTool('ellipse')} title="Ellipse">
          <Circle size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'triangle' ? 'active' : ''}`} onClick={() => setTool('triangle')} title="Triangle">
          <Triangle size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'line' ? 'active' : ''}`} onClick={() => setTool('line')} title="Line">
          <Minus size={20} />
        </button>
        <button className={`tool-btn ${activeTool === 'arrow' ? 'active' : ''}`} onClick={() => setTool('arrow')} title="Arrow">
          <ArrowRight size={20} />
        </button>
      </div>

      {/* Properties Group */}
      <div className="toolbar-group">
        <div className="color-picker-wrapper" title="Color">
          <input
            type="color"
            className="color-picker"
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <input
          type="range"
          min="1"
          max="20"
          className="size-slider"
          onChange={(e) => setSize(e.target.value)}
          title="Stroke Size"
        />
      </div>

      {/* Actions Group */}
      <div className="toolbar-group">
        <button className="tool-btn" onClick={onDelete} title="Delete Selected (Del)">
          <Trash2 size={20} />
        </button>
        <button className="tool-btn" onClick={onUndo} title="Undo (Ctrl+Z)">
          <Undo2 size={20} />
        </button>
        <button className="tool-btn" onClick={onRedo} title="Redo (Ctrl+Y)">
          <Redo2 size={20} />
        </button>
      </div>

      {/* Zoom Display */}
      {zoom !== undefined && (
        <div className="toolbar-group">
          <span className="zoom-badge">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
