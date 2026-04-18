import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="nav">
      <div className="nav-brand">🌱 SmartSeason</div>
      <div className="nav-links">
        <NavLink to="/dashboard" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Dashboard</NavLink>
        <NavLink to="/fields" className={({isActive}) => `nav-link ${isActive ? 'active' : ''}`}>Fields</NavLink>
        <span style={{color:'rgba(255,255,255,0.6)', fontSize:13, marginLeft:8}}>
          {user?.name} ({user?.role})
        </span>
        <button className="nav-btn" onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
