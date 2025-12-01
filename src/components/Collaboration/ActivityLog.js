import { useState, useEffect } from 'react';
import { getBoardActivity } from '../../supabase';
import { History } from 'lucide-react';
import './Collaboration.css';

export default function ActivityLog({ boardId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (boardId) {
      loadActivity();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  const loadActivity = async () => {
    setLoading(true);
    const { data, error } = await getBoardActivity(boardId);
    if (!error && data) {
      setActivities(data);
    }
    setLoading(false);
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

    return date.toLocaleDateString();
  };

  const getActionText = (activity) => {
    const userName = activity.user?.display_name || 'Someone';
    
    switch (activity.action) {
      case 'created':
        return <><strong>{userName}</strong> created this board</>;
      case 'updated':
        return <><strong>{userName}</strong> made changes</>;
      case 'deleted':
        return <><strong>{userName}</strong> deleted content</>;
      case 'joined':
        return <><strong>{userName}</strong> joined the board</>;
      case 'left':
        return <><strong>{userName}</strong> left the board</>;
      case 'shared':
        if (activity.details?.invited_email) {
          return <><strong>{userName}</strong> invited {activity.details.invited_email}</>;
        }
        if (activity.details?.action === 'removed_collaborator') {
          return <><strong>{userName}</strong> removed {activity.details.removed_user}</>;
        }
        return <><strong>{userName}</strong> shared this board</>;
      default:
        return <><strong>{userName}</strong> performed an action</>;
    }
  };

  if (loading) {
    return (
      <div className="activity-section">
        <h3>
          <History size={18} />
          Activity
        </h3>
        <p className="no-activity">Loading activity...</p>
      </div>
    );
  }

  return (
    <div className="activity-section">
      <h3>
        <History size={18} />
        Recent Activity
      </h3>

      {activities.length === 0 ? (
        <p className="no-activity">No activity yet</p>
      ) : (
        <div className="activity-list">
          {activities.map(activity => (
            <div key={activity.id} className="activity-item">
              <img
                src={activity.user?.avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${activity.user_id}`}
                alt=""
                className="activity-avatar"
                referrerPolicy="no-referrer"
              />
              <div className="activity-content">
                <p className="activity-text">
                  {getActionText(activity)}
                </p>
                <p className="activity-time">{formatTime(activity.created_at)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
