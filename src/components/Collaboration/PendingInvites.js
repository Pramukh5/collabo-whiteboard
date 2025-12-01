import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getMyPendingInvites, acceptInvite, deleteInvite } from '../../supabase';
import { Mail } from 'lucide-react';
import './Collaboration.css';

export default function PendingInvites() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.email) {
      loadInvites();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email]);

  const loadInvites = async () => {
    setLoading(true);
    console.log('Loading invites for:', user.email);
    const { data, error } = await getMyPendingInvites(user.email);
    console.log('Invites loaded:', { data, error });
    if (!error && data) {
      setInvites(data);
    } else if (error) {
      console.error('Error loading invites:', error);
    }
    setLoading(false);
  };

  const handleAccept = async (invite) => {
    console.log('Accepting invite:', invite);
    const { data, error } = await acceptInvite(invite.token, user.id);
    console.log('Accept result:', { data, error });
    if (error) {
      console.error('Error accepting invite:', error);
      alert('Failed to accept invite: ' + (error.message || 'Unknown error'));
      return;
    }
    if (data) {
      navigate(`/board/${data.board_id}`);
    }
  };

  const handleDecline = async (invite) => {
    await deleteInvite(invite.id);
    setInvites(invites.filter(i => i.id !== invite.id));
  };

  if (loading || invites.length === 0) {
    return null;
  }

  return (
    <div className="pending-invites-banner">
      <h4>
        <Mail size={18} />
        You have {invites.length} pending invite{invites.length > 1 ? 's' : ''}
      </h4>
      
      {invites.map(invite => (
        <div key={invite.id} className="pending-invite-item">
          <div className="pending-invite-info">
            <img
              src={invite.inviter?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${invite.invited_by}`}
              alt=""
              referrerPolicy="no-referrer"
            />
            <div className="pending-invite-details">
              <span className="board-name">{invite.board?.title || 'Untitled Board'}</span>
              <span className="inviter">
                Invited by {invite.inviter?.display_name || 'Someone'}
              </span>
            </div>
          </div>
          <div className="pending-invite-actions">
            <button className="accept" onClick={() => handleAccept(invite)}>
              Accept
            </button>
            <button className="decline" onClick={() => handleDecline(invite)}>
              Decline
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
