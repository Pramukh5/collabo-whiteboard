import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../supabase';
import { LogOut, User, LayoutDashboard } from 'lucide-react';
import './UserProfile.css';

export default function UserProfile() {
  const { user, getDisplayName, getAvatarUrl } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const handleDashboard = () => {
    setShowDropdown(false);
    navigate('/dashboard');
  };

  if (!user) return null;

  return (
    <div className="user-profile" ref={dropdownRef}>
      <button
        className="user-avatar-btn"
        onClick={() => setShowDropdown(!showDropdown)}
        title={getDisplayName()}
      >
        <img
          src={getAvatarUrl()}
          alt={getDisplayName()}
          className="user-avatar"
          referrerPolicy="no-referrer"
        />
      </button>

      {showDropdown && (
        <div className="user-dropdown">
          <div className="user-dropdown-header">
            <img
              src={getAvatarUrl()}
              alt={getDisplayName()}
              className="dropdown-avatar"
              referrerPolicy="no-referrer"
            />
            <div className="user-info">
              <span className="user-name">{getDisplayName()}</span>
              <span className="user-email">{user.email}</span>
            </div>
          </div>
          
          <div className="dropdown-divider" />
          
          <button className="dropdown-item" onClick={handleDashboard}>
            <LayoutDashboard size={18} />
            Dashboard
          </button>
          
          <button className="dropdown-item" onClick={() => setShowDropdown(false)}>
            <User size={18} />
            Profile
          </button>
          
          <div className="dropdown-divider" />
          
          <button className="dropdown-item logout" onClick={handleSignOut}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
