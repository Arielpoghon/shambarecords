import React, { useEffect, useState } from 'react';
import {
  addFieldUpdate,
  createField,
  deleteField,
  getAgents,
  getFields,
  getFieldUpdates,
  updateField
} from '../api';
import { useAuth } from '../AuthContext';

const STAGES = ['planted', 'growing', 'ready', 'harvested'];
const emptyCreateForm = {
  name: '',
  crop_type: '',
  planting_date: '',
  assigned_agent_id: '',
  stage: 'planted'
};

export default function Fields() {
  const [fields, setFields] = useState([]);
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedField, setSelectedField] = useState(null);
  const [updates, setUpdates] = useState([]);
  const [updateForm, setUpdateForm] = useState({ stage: 'planted', notes: '' });
  const [editForm, setEditForm] = useState(emptyCreateForm);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user } = useAuth();

  const load = async (fieldToKeepOpen) => {
    try {
      setError('');
      const res = await getFields();
      setFields(res.data);

      if (user.role === 'admin') {
        const ag = await getAgents();
        setAgents(ag.data);
      }

      if (fieldToKeepOpen) {
        const refreshedField = res.data.find((field) => field.id === fieldToKeepOpen.id);
        if (refreshedField) {
          setSelectedField(refreshedField);
          setEditForm({
            name: refreshedField.name,
            crop_type: refreshedField.crop_type,
            planting_date: refreshedField.planting_date?.slice(0, 10) || '',
            assigned_agent_id: refreshedField.assigned_agent_id || '',
            stage: refreshedField.stage
          });
          setUpdateForm({ stage: refreshedField.stage, notes: '' });
        } else {
          setSelectedField(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load fields');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openField = async (field) => {
    try {
      setError('');
      setSuccess('');
      setSelectedField(field);
      setEditForm({
        name: field.name,
        crop_type: field.crop_type,
        planting_date: field.planting_date?.slice(0, 10) || '',
        assigned_agent_id: field.assigned_agent_id || '',
        stage: field.stage
      });
      setUpdateForm({ stage: field.stage, notes: '' });
      const res = await getFieldUpdates(field.id);
      setUpdates(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load field activity');
    }
  };

  const closeModal = () => {
    setSelectedField(null);
    setUpdates([]);
    setUpdateForm({ stage: 'planted', notes: '' });
    setEditForm(emptyCreateForm);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await createField(createForm);
      setShowCreate(false);
      setCreateForm(emptyCreateForm);
      setSuccess('Field created successfully.');
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to create field');
    }
  };

  const handleAdminSave = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await updateField(selectedField.id, editForm);
      const res = await getFieldUpdates(selectedField.id);
      setUpdates(res.data);
      setSuccess('Field details updated.');
      await load(selectedField);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update field');
    }
  };

  const handleAgentUpdate = async (e) => {
    e.preventDefault();
    try {
      setError('');
      await addFieldUpdate(selectedField.id, updateForm);
      const res = await getFieldUpdates(selectedField.id);
      setUpdates(res.data);
      setSuccess('Field update submitted.');
      await load(selectedField);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit update');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this field?')) return;
    try {
      setError('');
      await deleteField(id);
      setSuccess('Field deleted.');
      if (selectedField?.id === id) {
        closeModal();
      }
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete field');
    }
  };

  if (loading) return <div className="page"><p>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fields</h1>
          <p className="page-subtitle">
            {user.role === 'admin'
              ? 'Create, assign, and monitor every field in the season.'
              : 'Track progress and log observations for your assigned fields.'}
          </p>
        </div>
        {user.role === 'admin' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Add Field</button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {fields.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <h3>No fields yet</h3>
            <p>{user.role === 'admin' ? 'Create your first field to get started.' : 'No fields are assigned to you yet.'}</p>
          </div>
        </div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Crop</th>
                <th>Planted</th>
                <th>Stage</th>
                <th>Status</th>
                {user.role === 'admin' && <th>Agent</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id}>
                  <td><strong>{field.name}</strong></td>
                  <td>{field.crop_type}</td>
                  <td>{new Date(field.planting_date).toLocaleDateString()}</td>
                  <td><span className={`badge badge-${field.stage}`}>{field.stage}</span></td>
                  <td><span className={`badge badge-${field.status}`}>{field.status.replace('_', ' ')}</span></td>
                  {user.role === 'admin' && <td>{field.agent_name || 'Unassigned'}</td>}
                  <td>
                    <button
                      className="btn btn-secondary"
                      style={{ marginRight: 8, padding: '6px 12px', fontSize: 13 }}
                      onClick={() => openField(field)}
                    >
                      {user.role === 'admin' ? 'Manage' : 'Update'}
                    </button>
                    {user.role === 'admin' && (
                      <button
                        className="btn btn-danger"
                        style={{ padding: '6px 12px', fontSize: 13 }}
                        onClick={() => handleDelete(field.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add New Field</h2>
              <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Field Name</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  required
                  placeholder="e.g. North Plot A"
                />
              </div>
              <div className="form-group">
                <label>Crop Type</label>
                <input
                  value={createForm.crop_type}
                  onChange={(e) => setCreateForm({ ...createForm, crop_type: e.target.value })}
                  required
                  placeholder="e.g. Maize, Wheat, Tomatoes"
                />
              </div>
              <div className="form-group">
                <label>Planting Date</label>
                <input
                  type="date"
                  value={createForm.planting_date}
                  onChange={(e) => setCreateForm({ ...createForm, planting_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Current Stage</label>
                <select
                  value={createForm.stage}
                  onChange={(e) => setCreateForm({ ...createForm, stage: e.target.value })}
                >
                  {STAGES.map((stage) => (
                    <option key={stage} value={stage}>
                      {stage.charAt(0).toUpperCase() + stage.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Assign to Agent</label>
                <select
                  value={createForm.assigned_agent_id}
                  onChange={(e) => setCreateForm({ ...createForm, assigned_agent_id: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </select>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Field</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedField && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ width: 620 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{selectedField.name}</h2>
                <p className="modal-subtitle">
                  {user.role === 'admin'
                    ? 'Manage field details, assignment, and current stage.'
                    : 'Update the field stage and leave observations from your visit.'}
                </p>
              </div>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>

            <div style={{ marginBottom: 20, padding: 16, background: '#f9f9f9', borderRadius: 8, fontSize: 14 }}>
              <strong>Status:</strong> <span className={`badge badge-${selectedField.status}`}>{selectedField.status.replace('_', ' ')}</span>
              <span style={{ marginLeft: 12 }}><strong>Agent:</strong> {selectedField.agent_name || 'Unassigned'}</span>
            </div>

            {user.role === 'admin' ? (
              <form onSubmit={handleAdminSave}>
                <div className="form-group">
                  <label>Field Name</label>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Crop Type</label>
                  <input
                    value={editForm.crop_type}
                    onChange={(e) => setEditForm({ ...editForm, crop_type: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Planting Date</label>
                  <input
                    type="date"
                    value={editForm.planting_date}
                    onChange={(e) => setEditForm({ ...editForm, planting_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Current Stage</label>
                  <select
                    value={editForm.stage}
                    onChange={(e) => setEditForm({ ...editForm, stage: e.target.value })}
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Assigned Agent</label>
                  <select
                    value={editForm.assigned_agent_id}
                    onChange={(e) => setEditForm({ ...editForm, assigned_agent_id: e.target.value })}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </form>
            ) : (
              <form onSubmit={handleAgentUpdate}>
                <div className="form-group">
                  <label>Update Stage</label>
                  <select
                    value={updateForm.stage}
                    onChange={(e) => setUpdateForm({ ...updateForm, stage: e.target.value })}
                    required
                  >
                    {STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {stage.charAt(0).toUpperCase() + stage.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Notes / Observations</label>
                  <textarea
                    value={updateForm.notes}
                    onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                    rows={3}
                    placeholder="Add observations from this field visit..."
                  />
                </div>
                <button type="submit" className="btn btn-primary">Submit Update</button>
              </form>
            )}

            <div style={{ marginTop: 24 }}>
              <h3 style={{ fontSize: 16, marginBottom: 12 }}>Update History</h3>
              {updates.length === 0 ? (
                <p style={{ color: '#888', fontSize: 13 }}>No updates yet.</p>
              ) : (
                updates.map((update) => (
                  <div key={update.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span className={`badge badge-${update.stage}`}>{update.stage}</span>
                      <span style={{ fontSize: 12, color: '#888' }}>
                        {new Date(update.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: '#555' }}>
                      {update.agent_name}: {update.notes || 'No notes'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
