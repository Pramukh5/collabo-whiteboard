import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getBoards, createBoard, deleteBoard, logActivity } from '../../supabase';
import { Plus, Trash2, Clock, Users, LogOut, Share2 } from 'lucide-react';
import { signOut } from '../../supabase';
import { ShareBoard, PendingInvites } from '../Collaboration';
import './Dashboard.css';

export default function Dashboard() {
  const { user, getDisplayName, getAvatarUrl } = useAuth();
  const [boards, setBoards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNewBoardModal, setShowNewBoardModal] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [shareBoard, setShareBoard] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      loadBoards();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const loadBoards = async () => {
    setLoading(true);
    console.log('Loading boards for user:', user.id);
    const { data, error } = await getBoards(user.id);
    console.log('Boards result:', { data, error });
    if (!error && data) {
      setBoards(data);
    } else if (error) {
      console.error('Failed to load boards:', error);
    }
    setLoading(false);
  };

  const handleCreateBoard = async (e) => {
    e.preventDefault();
    if (!newBoardTitle.trim()) return;

    setCreating(true);
    const { data, error } = await createBoard(newBoardTitle.trim(), user.id);
    
    if (!error && data) {
      // Log activity
      await logActivity(data.id, user.id, 'created', { title: newBoardTitle.trim() });
      setShowNewBoardModal(false);
      setNewBoardTitle('');
      navigate(`/board/${data.id}`);
    }
    setCreating(false);
  };

  const handleDeleteBoard = async (boardId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this board?')) return;
    
    const { error } = await deleteBoard(boardId);
    if (!error) {
      setBoards(boards.filter(b => b.id !== boardId));
    }
  };

  const handleShareBoard = (board, e) => {
    e.stopPropagation();
    setShareBoard(board);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <h1 className="sidebar-logo">Collabo</h1>
        </div>
        
        <nav className="sidebar-nav">
          <button className="nav-item active">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            My Boards
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <img src={getAvatarUrl()} alt={getDisplayName()} className="sidebar-avatar" referrerPolicy="no-referrer" />
            <span className="sidebar-username">{getDisplayName()}</span>
          </div>
          <button className="sidebar-logout" onClick={handleSignOut} title="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <h2>My Boards</h2>
          <button className="new-board-btn" onClick={() => setShowNewBoardModal(true)}>
            <Plus size={20} />
            New Board
          </button>
        </header>

        {/* Pending Invites */}
        <PendingInvites />

        {loading ? (
          <div className="dashboard-loading">
            <div className="loading-spinner" />
            <p>Loading your boards...</p>
          </div>
        ) : boards.length === 0 ? (
          <div className="dashboard-empty">
            <div className="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </div>
            <h3>No boards yet</h3>
            <p>Create your first board to start collaborating</p>
            <button className="new-board-btn" onClick={() => setShowNewBoardModal(true)}>
              <Plus size={20} />
              Create Board
            </button>
          </div>
        ) : (
          <div className="boards-grid">
            {boards.map((board) => (
              <div
                key={board.id}
                className="board-card"
                onClick={() => navigate(`/board/${board.id}`)}
              >
                <div className="board-preview">
                  <div className="board-preview-content" />
                </div>
                <div className="board-info">
                  <h3 className="board-title">{board.title}</h3>
                  <div className="board-meta">
                    <span className="board-date">
                      <Clock size={14} />
                      {formatDate(board.updated_at)}
                    </span>
                    {board.collaborators?.length > 0 && (
                      <span className="board-collabs">
                        <Users size={14} />
                        {board.collaborators.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="board-actions">
                  {board.owner_id === user.id && (
                    <button
                      className="board-share"
                      onClick={(e) => handleShareBoard(board, e)}
                      title="Share board"
                    >
                      <Share2 size={16} />
                    </button>
                  )}
                  <button
                    className="board-delete"
                    onClick={(e) => handleDeleteBoard(board.id, e)}
                    title="Delete board"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Board Modal */}
      {showNewBoardModal && (
        <div className="modal-overlay" onClick={() => setShowNewBoardModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Create New Board</h3>
            <form onSubmit={handleCreateBoard}>
              <input
                type="text"
                placeholder="Board name"
                value={newBoardTitle}
                onChange={(e) => setNewBoardTitle(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                <button
                  type="button"
                  className="modal-btn secondary"
                  onClick={() => setShowNewBoardModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="modal-btn primary"
                  disabled={creating || !newBoardTitle.trim()}
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Share Board Modal */}
      {shareBoard && (
        <ShareBoard
          board={shareBoard}
          onClose={() => setShareBoard(null)}
        />
      )}
    </div>
  );
}
