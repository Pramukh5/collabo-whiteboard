import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getInviteByToken, acceptInvite } from '../../supabase';
import { Loader2, AlertCircle } from 'lucide-react';
import './Collaboration.css';

export default function AcceptInvite() {
  const { token } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInvite();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInvite = async () => {
    setLoading(true);
    const { data, error } = await getInviteByToken(token);
    
    if (error || !data) {
      setInvite(null);
    } else {
      setInvite(data);
    }
    setLoading(false);
  };

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/invite/${token}`);
      return;
    }

    setAccepting(true);
    setError('');

    const { data, error } = await acceptInvite(token, user.id);

    if (error) {
      setError(error.message);
      setAccepting(false);
    } else {
      // Redirect to the board
      navigate(`/board/${data.board_id}`);
    }
  };

  const handleDecline = () => {
    navigate('/dashboard');
  };

  if (loading || authLoading) {
    return (
      <div className="invite-page">
        <div className="invite-card invite-loading">
          <Loader2 size={40} className="animate-spin" style={{ color: '#89b4fa' }} />
          <p>Loading invite...</p>
        </div>
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="invite-page">
        <div className="invite-card invite-expired">
          <AlertCircle size={48} style={{ color: '#f38ba8' }} />
          <h2>Invite Not Found</h2>
          <p>This invite link is invalid or has expired.</p>
          <Link to="/dashboard">Go to Dashboard</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-page">
      <div className="invite-card">
        <h1>You've been invited!</h1>
        <p className="invite-description">
          You've been invited to collaborate on a whiteboard
        </p>

        <div className="invite-details">
          <p className="board-title">{invite.board?.title || 'Untitled Board'}</p>
          <div className="invited-by">
            <img
              src={invite.inviter?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${invite.invited_by}`}
              alt={invite.inviter?.display_name}
              referrerPolicy="no-referrer"
            />
            <span>Invited by {invite.inviter?.display_name || 'Someone'}</span>
          </div>
          <span className="role-badge">
            {invite.role === 'editor' ? 'Can edit' : 'View only'}
          </span>
        </div>

        <div className="invite-actions-page">
          {!user ? (
            <>
              <button className="accept-btn" onClick={handleAccept}>
                Sign in to Accept
              </button>
              <p style={{ color: '#6c7086', fontSize: '14px', margin: '8px 0 0' }}>
                You need to sign in or create an account to join this board
              </p>
            </>
          ) : (
            <>
              <button
                className="accept-btn"
                onClick={handleAccept}
                disabled={accepting}
              >
                {accepting ? 'Joining...' : 'Accept Invite'}
              </button>
              <button className="decline-btn" onClick={handleDecline}>
                Decline
              </button>
            </>
          )}
        </div>

        {error && <p className="invite-error-page">{error}</p>}
      </div>
    </div>
  );
}
