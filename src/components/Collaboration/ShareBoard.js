import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  getBoardCollaborators,
  getBoardInvites,
  createBoardInvite,
  removeCollaborator,
  updateCollaboratorRole,
  deleteInvite,
  logActivity,
} from '../../supabase';
import { X, UserPlus, Copy, Check, Trash2, Crown, Users, Mail, Clock } from 'lucide-react';
import './Collaboration.css';

export default function ShareBoard({ board, onClose }) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [loading, setLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isOwner = board?.owner_id === user?.id;

  useEffect(() => {
    if (board?.id) {
      loadCollaborators();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board?.id]);

  const loadCollaborators = async () => {
    setLoading(true);
    const [collabResult, invitesResult] = await Promise.all([
      getBoardCollaborators(board.id),
      getBoardInvites(board.id),
    ]);

    if (collabResult.data) {
      setCollaborators(collabResult.data);
    }
    if (invitesResult.data) {
      setPendingInvites(invitesResult.data);
    }
    setLoading(false);
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    setInviting(true);
    setError('');
    setSuccess('');

    // Check if already a collaborator
    const existingCollab = collaborators.find(
      c => c.user?.email?.toLowerCase() === email.toLowerCase()
    );
    if (existingCollab) {
      setError('This user is already a collaborator');
      setInviting(false);
      return;
    }

    const { error: inviteError, isExisting } = await createBoardInvite(
      board.id,
      email,
      role,
      user.id
    );

    if (inviteError) {
      setError(inviteError.message);
    } else {
      if (isExisting) {
        setSuccess('Invite already sent to this email');
      } else {
        setSuccess(`Invite sent to ${email}`);
        await logActivity(board.id, user.id, 'shared', {
          invited_email: email,
          role,
        });
      }
      setEmail('');
      loadCollaborators();
    }
    setInviting(false);
  };

  const handleRemoveCollaborator = async (userId, displayName) => {
    if (!window.confirm(`Remove ${displayName} from this board?`)) return;

    const { error } = await removeCollaborator(board.id, userId);
    if (!error) {
      setCollaborators(collaborators.filter(c => c.user_id !== userId));
      await logActivity(board.id, user.id, 'shared', {
        action: 'removed_collaborator',
        removed_user: displayName,
      });
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    const { error } = await updateCollaboratorRole(board.id, userId, newRole);
    if (!error) {
      setCollaborators(collaborators.map(c =>
        c.user_id === userId ? { ...c, role: newRole } : c
      ));
    }
  };

  const handleDeleteInvite = async (inviteId, email) => {
    if (!window.confirm(`Cancel invite to ${email}?`)) return;

    const { error } = await deleteInvite(inviteId);
    if (!error) {
      setPendingInvites(pendingInvites.filter(i => i.id !== inviteId));
    }
  };

  const copyInviteLink = async (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatExpiry = (expiresAt) => {
    const days = Math.ceil((new Date(expiresAt) - new Date()) / (1000 * 60 * 60 * 24));
    return days === 1 ? '1 day' : `${days} days`;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        <div className="share-header">
          <h2>Share "{board?.title}"</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {isOwner && (
          <form className="invite-form" onSubmit={handleInvite}>
            <div className="invite-input-group">
              <Mail size={18} className="input-icon" />
              <input
                type="email"
                placeholder="Enter email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={inviting}
              />
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                disabled={inviting}
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
              </select>
              <button type="submit" disabled={inviting || !email.trim()}>
                <UserPlus size={18} />
                {inviting ? 'Sending...' : 'Invite'}
              </button>
            </div>
            {error && <p className="invite-error">{error}</p>}
            {success && <p className="invite-success">{success}</p>}
          </form>
        )}

        <div className="share-content">
          {loading ? (
            <div className="share-loading">Loading collaborators...</div>
          ) : (
            <>
              <div className="collaborators-section">
                <h3>
                  <Users size={18} />
                  People with access
                </h3>
                
                <div className="collaborator-list">
                  {/* Owner */}
                  <div className="collaborator-item owner">
                    <div className="collaborator-info">
                      <img
                        src={`https://api.dicebear.com/7.x/initials/svg?seed=${board?.owner_id}`}
                        alt="Owner"
                        className="collaborator-avatar"
                      />
                      <div className="collaborator-details">
                        <span className="collaborator-name">
                          {board?.owner_id === user?.id ? 'You' : 'Owner'}
                        </span>
                        <span className="collaborator-role">
                          <Crown size={14} /> Owner
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Collaborators */}
                  {collaborators.map(collab => (
                    <div key={collab.id} className="collaborator-item">
                      <div className="collaborator-info">
                        <img
                          src={collab.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${collab.user_id}`}
                          alt={collab.user?.display_name}
                          className="collaborator-avatar"
                          referrerPolicy="no-referrer"
                        />
                        <div className="collaborator-details">
                          <span className="collaborator-name">
                            {collab.user?.display_name || 'Unknown User'}
                            {collab.user_id === user?.id && ' (You)'}
                          </span>
                          {isOwner ? (
                            <select
                              value={collab.role}
                              onChange={e => handleRoleChange(collab.user_id, e.target.value)}
                              className="role-select"
                            >
                              <option value="editor">Can edit</option>
                              <option value="viewer">Can view</option>
                            </select>
                          ) : (
                            <span className="collaborator-role">
                              {collab.role === 'editor' ? 'Can edit' : 'Can view'}
                            </span>
                          )}
                        </div>
                      </div>
                      {isOwner && collab.user_id !== user?.id && (
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveCollaborator(collab.user_id, collab.user?.display_name)}
                          title="Remove collaborator"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}

                  {collaborators.length === 0 && (
                    <p className="no-collaborators">No collaborators yet</p>
                  )}
                </div>
              </div>

              {isOwner && pendingInvites.length > 0 && (
                <div className="invites-section">
                  <h3>
                    <Mail size={18} />
                    Pending invites
                  </h3>
                  
                  <div className="invite-list">
                    {pendingInvites.map(invite => (
                      <div key={invite.id} className="invite-item">
                        <div className="invite-info">
                          <span className="invite-email">{invite.email}</span>
                          <span className="invite-meta">
                            <Clock size={12} />
                            Expires in {formatExpiry(invite.expires_at)}
                          </span>
                        </div>
                        <div className="invite-actions">
                          <button
                            className="copy-link-btn"
                            onClick={() => copyInviteLink(invite.token)}
                            title="Copy invite link"
                          >
                            {copied ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                          <button
                            className="remove-btn"
                            onClick={() => handleDeleteInvite(invite.id, invite.email)}
                            title="Cancel invite"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
