import { render, screen, fireEvent } from '@testing-library/react';
import Toolbar from './Toolbar';

// Helper to find button by title (desktop toolbar uses title, mobile uses aria-label)
const getButtonByTitle = (title) => {
  return document.querySelector(`button[title="${title}"]`) ||
         screen.queryByLabelText(title);
};

describe('Toolbar Component', () => {
  const defaultProps = {
    setColor: jest.fn(),
    setSize: jest.fn(),
    setTool: jest.fn(),
    onUndo: jest.fn(),
    onRedo: jest.fn(),
    onDelete: jest.fn(),
    zoom: 1,
    activeTool: 'pen',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Set desktop viewport
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 768 });
  });

  describe('Tool Selection', () => {
    test('renders toolbar container', () => {
      render(<Toolbar {...defaultProps} />);
      
      const toolbar = document.querySelector('.toolbar-container');
      expect(toolbar).toBeInTheDocument();
    });

    test('calls setTool with "select" when select button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const selectButton = getButtonByTitle('Select');
      fireEvent.click(selectButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('select');
    });

    test('calls setTool with "pan" when pan button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const panButton = getButtonByTitle('Pan');
      fireEvent.click(panButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('pan');
    });

    test('calls setTool with "pen" when pen button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const penButton = getButtonByTitle('Pen');
      fireEvent.click(penButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('pen');
    });

    test('calls setTool with "erase" when eraser button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const eraserButton = getButtonByTitle('Eraser');
      fireEvent.click(eraserButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('erase');
    });

    test('calls setTool with "text" when text button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const textButton = getButtonByTitle('Text');
      fireEvent.click(textButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('text');
    });

    test('calls setTool with "stickyNote" when sticky note button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const stickyNoteButton = getButtonByTitle('Sticky Note');
      fireEvent.click(stickyNoteButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('stickyNote');
    });

    test('highlights active tool button', () => {
      render(<Toolbar {...defaultProps} activeTool="pen" />);
      
      const penButton = getButtonByTitle('Pen');
      expect(penButton).toHaveClass('active');
    });
  });

  describe('Shape Tools', () => {
    test('calls setTool with "rectangle" when rectangle clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const rectButton = getButtonByTitle('Rectangle');
      fireEvent.click(rectButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('rectangle');
    });

    test('calls setTool with "ellipse" when ellipse clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const ellipseButton = getButtonByTitle('Ellipse');
      fireEvent.click(ellipseButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('ellipse');
    });

    test('calls setTool with "line" when line clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const lineButton = getButtonByTitle('Line');
      fireEvent.click(lineButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('line');
    });

    test('calls setTool with "arrow" when arrow clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const arrowButton = getButtonByTitle('Arrow');
      fireEvent.click(arrowButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('arrow');
    });

    test('calls setTool with "triangle" when triangle clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const triangleButton = getButtonByTitle('Triangle');
      fireEvent.click(triangleButton);
      
      expect(defaultProps.setTool).toHaveBeenCalledWith('triangle');
    });
  });

  describe('Undo/Redo', () => {
    test('calls onUndo when undo button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      // Desktop uses title with keyboard shortcut
      const undoButton = document.querySelector('button[title*="Undo"]');
      fireEvent.click(undoButton);
      
      expect(defaultProps.onUndo).toHaveBeenCalled();
    });

    test('calls onRedo when redo button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const redoButton = document.querySelector('button[title*="Redo"]');
      fireEvent.click(redoButton);
      
      expect(defaultProps.onRedo).toHaveBeenCalled();
    });
  });

  describe('Delete', () => {
    test('calls onDelete when delete button clicked', () => {
      render(<Toolbar {...defaultProps} />);
      
      const deleteButton = document.querySelector('button[title*="Delete"]');
      fireEvent.click(deleteButton);
      
      expect(defaultProps.onDelete).toHaveBeenCalled();
    });
  });

  describe('Color Picker', () => {
    test('renders color input', () => {
      render(<Toolbar {...defaultProps} />);
      
      const colorInput = document.querySelector('input[type="color"]');
      expect(colorInput).toBeInTheDocument();
    });

    test('calls setColor when color changed', () => {
      render(<Toolbar {...defaultProps} />);
      
      const colorInput = document.querySelector('input[type="color"]');
      fireEvent.change(colorInput, { target: { value: '#ff5500' } });
      
      expect(defaultProps.setColor).toHaveBeenCalledWith('#ff5500');
    });
  });

  describe('Size Slider', () => {
    test('renders size slider', () => {
      render(<Toolbar {...defaultProps} />);
      
      const sizeSlider = document.querySelector('input[type="range"]');
      expect(sizeSlider).toBeInTheDocument();
    });

    test('calls setSize when size changed', () => {
      render(<Toolbar {...defaultProps} />);
      
      const sizeSlider = document.querySelector('input[type="range"]');
      fireEvent.change(sizeSlider, { target: { value: '10' } });
      
      expect(defaultProps.setSize).toHaveBeenCalled();
    });
  });

  describe('Zoom Display', () => {
    test('displays current zoom level', () => {
      render(<Toolbar {...defaultProps} zoom={1.5} />);
      
      expect(screen.getByText('150%')).toBeInTheDocument();
    });

    test('displays 100% zoom', () => {
      render(<Toolbar {...defaultProps} zoom={1} />);
      
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    test('displays 200% zoom', () => {
      render(<Toolbar {...defaultProps} zoom={2} />);
      
      expect(screen.getByText('200%')).toBeInTheDocument();
    });
  });

  describe('Active Tool Highlighting', () => {
    test('pen button is active when activeTool is pen', () => {
      render(<Toolbar {...defaultProps} activeTool="pen" />);
      
      const penButton = getButtonByTitle('Pen');
      expect(penButton).toHaveClass('active');
    });

    test('eraser button is active when activeTool is erase', () => {
      render(<Toolbar {...defaultProps} activeTool="erase" />);
      
      const eraserButton = getButtonByTitle('Eraser');
      expect(eraserButton).toHaveClass('active');
    });

    test('select button is active when activeTool is select', () => {
      render(<Toolbar {...defaultProps} activeTool="select" />);
      
      const selectButton = getButtonByTitle('Select');
      expect(selectButton).toHaveClass('active');
    });
  });
});
