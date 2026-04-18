import React, { useState, useEffect } from 'react';
import { getDashboard } from '../api';
import { useAuth } from '../AuthContext';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    getDashboard().then(res => { setData(res.data); setLoading(false); });
  }, []);

  if (loading) return <div className="page"><p>Loading...</p></div>;

  const { summary, fields } = data;

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">
          {user.role === 'admin' ? 'Admin Dashboard' : 'My Fields Dashboard'}
        </h1>
        <span style={{color:'#888', fontSize:14}}>Welcome back, {user.name}</span>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total Fields</div>
          <div className="stat-value">{summary.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active</div>
          <div className="stat-value" style={{color:'#2d6a4f'}}>{summary.active}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">At Risk</div>
          <div className="stat-value" style={{color:'#856404'}}>{summary.at_risk}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Completed</div>
          <div className="stat-value" style={{color:'#555'}}>{summary.completed}</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20, marginBottom:28}}>
        <div className="card">
          <h3 style={{marginBottom:16, fontSize:18}}>Stage Breakdown</h3>
          {Object.entries(summary.by_stage).map(([stage, count]) => (
            <div key={stage} style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12}}>
              <span className={`badge badge-${stage}`}>{stage.charAt(0).toUpperCase() + stage.slice(1)}</span>
              <div style={{flex:1, margin:'0 12px', height:8, background:'#f0f0f0', borderRadius:4}}>
                <div style={{width: summary.total ? `${(count/summary.total)*100}%` : '0%', height:'100%', background:'#2d6a4f', borderRadius:4}} />
              </div>
              <strong>{count}</strong>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 style={{marginBottom:16, fontSize:18}}>Fields Needing Attention</h3>
          {fields.filter(f => f.status === 'at_risk').length === 0 ? (
            <p style={{color:'#888', fontSize:14}}>✅ No fields at risk right now</p>
          ) : (
            fields.filter(f => f.status === 'at_risk').map(field => (
              <div key={field.id} style={{padding:'10px 0', borderBottom:'1px solid #f0f0f0'}}>
                <div style={{fontWeight:500}}>{field.name}</div>
                <div style={{fontSize:13, color:'#888'}}>{field.crop_type} • {field.stage}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{marginBottom:16, fontSize:18}}>Recent Fields</h3>
        {fields.length === 0 ? (
          <div className="empty-state"><h3>No fields yet</h3><p>Fields will appear here once created</p></div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Field Name</th>
                <th>Crop</th>
                <th>Stage</th>
                <th>Status</th>
                {user.role === 'admin' && <th>Agent</th>}
                <th>Planted</th>
              </tr>
            </thead>
            <tbody>
              {fields.slice(0, 8).map(field => (
                <tr key={field.id}>
                  <td><strong>{field.name}</strong></td>
                  <td>{field.crop_type}</td>
                  <td><span className={`badge badge-${field.stage}`}>{field.stage}</span></td>
                  <td><span className={`badge badge-${field.status}`}>{field.status.replace('_', ' ')}</span></td>
                  {user.role === 'admin' && <td>{field.agent_name || '—'}</td>}
                  <td>{new Date(field.planting_date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
