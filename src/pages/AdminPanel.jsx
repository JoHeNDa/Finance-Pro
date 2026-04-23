import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.js';
import { useAuth } from '../context/AuthContext.jsx';
import { formatCurrency } from '../utils/formatting.js';
import '../styles/adminPanel.css';  // ✅ import external CSS

export default function AdminPanel() {
  const { user, userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [saving, setSaving] = useState(false);
  const [orgStats, setOrgStats] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRevenue: 0,
    totalExpenses: 0
  });

  const isOwner = userProfile?.role === 'owner';
  const isAdmin = userProfile?.role === 'admin' || isOwner;
  const canManageUsers = isAdmin;

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
      fetchOrgStats();
    }
  }, [userProfile]);

  const fetchOrgStats = async () => {
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', userProfile.organization_id);

    const { data: transactions } = await supabase
      .from('transactions')
      .select('type, amount, vat_amount')
      .eq('organization_id', userProfile.organization_id);

    let revenue = 0, expenses = 0;
    if (transactions) {
      transactions.forEach(tx => {
        if (tx.type === 'Revenue') revenue += tx.amount;
        else expenses += tx.amount;
      });
    }

    setOrgStats({
      totalUsers: userCount || 0,
      totalTransactions: transactions?.length || 0,
      totalRevenue: revenue,
      totalExpenses: expenses
    });
  };

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('organization_id', userProfile.organization_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching users:', error);
    } else {
      setUsers(data);
    }
    setLoading(false);
  };

 const handleInvite = async (e) => {
  e.preventDefault();
  setError('');
  setSuccess('');
  setSaving(true);

  if (!inviteEmail || !inviteName) {
    setError('Please fill in all fields');
    setSaving(false);
    return;
  }

  try {
    // Call the deployed Edge Function
    const { data, error } = await supabase.functions.invoke('invite-user', {
  body: {
    email: inviteEmail,
    name: inviteName,
    organization_id: userProfile?.organization_id,
    role: inviteRole,
  },
});

if (error) {
  console.log("Edge function error:", error);
}

    if (functionError) {
      console.error('Function error:', functionError);
      throw new Error(functionError.message || 'Failed to invite user');
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    setSuccess(`User invited successfully! Temporary password: ${data.tempPassword}`);
    setInviteEmail('');
    setInviteName('');
    setInviteRole('member');
    setShowInviteModal(false);
    fetchUsers();
    fetchOrgStats();
  } catch (err) {
    setError(err.message);
  } finally {
    setSaving(false);
  }
};

  const updateUserRole = async (userId, newRole) => {
    if (!isOwner && newRole === 'owner') {
      setError('Only the organization owner can assign the owner role');
      return;
    }

    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);

    if (error) {
      setError('Failed to update user role');
    } else {
      setSuccess('User role updated successfully');
      fetchUsers();
    }
  };

  const removeUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this user? This action cannot be undone.')) return;
    
    setSaving(true);
    setError('');
    
    try {
      const { data, error: functionError } = await supabase.functions.invoke('delete-user', {
        body: { userId }
      });
      
      if (functionError) {
        console.error('Function error:', functionError);
        throw new Error(functionError.message);
      }
      
      const { error: deleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (deleteError) throw deleteError;
      
      setSuccess('User removed successfully');
      fetchUsers();
      fetchOrgStats();
    } catch (err) {
      console.error('Remove user error:', err);
      setError(err.message || 'Failed to remove user');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleBadgeClass = (role) => {
    switch(role) {
      case 'owner': return 'ap-role-badge owner';
      case 'admin': return 'ap-role-badge admin';
      case 'manager': return 'ap-role-badge manager';
      default: return 'ap-role-badge member';
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'owner': return 'fa-crown';
      case 'admin': return 'fa-shield-alt';
      case 'manager': return 'fa-chart-line';
      default: return 'fa-user';
    }
  };

  if (!canManageUsers) {
    return (
      <div className="ap-container">
        <div className="ap-access-denied">
          <div className="ap-access-icon">
            <i className="fas fa-lock"></i>
          </div>
          <h2>Access Denied</h2>
          <p>You don't have permission to access the admin panel.</p>
          <p className="ap-access-hint">Only Organization Owners and Admins can manage users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ap-container">
      {success && (
        <div className="ap-notification success">
          <i className="fas fa-check-circle"></i> {success}
        </div>
      )}
      {error && (
        <div className="ap-notification error">
          <i className="fas fa-exclamation-circle"></i> {error}
        </div>
      )}

      <div className="ap-header">
        <div>
          <h1> User Management</h1>
          <p className="ap-subtitle">Manage team members and their access permissions</p>
        </div>
        <button className="ap-invite-btn" onClick={() => setShowInviteModal(true)}>
          <i className="fas fa-user-plus"></i> Invite User
        </button>
      </div>

     <div className="ap-stats-grid">
  <div className="ap-stat-card">
    <div className="ap-stat-icon">
      <i className="fas fa-users"></i>
    </div>
    <div className="ap-stat-info">
      <h3>Total Users</h3>
      <p className="ap-stat-number">{orgStats.totalUsers}</p>
    </div>
  </div>
  <div className="ap-stat-card">
    <div className="ap-stat-icon">
      <i className="fas fa-exchange-alt"></i>
    </div>
    <div className="ap-stat-info">
      <h3>Transactions</h3>
      <p className="ap-stat-number">{orgStats.totalTransactions}</p>
    </div>
  </div>
  <div className="ap-stat-card">
    <div className="ap-stat-icon">
      <i className="fas fa-arrow-down"></i>
    </div>
    <div className="ap-stat-info">
      <h3>Total Revenue</h3>
      <p className="ap-stat-number">{formatCurrency(orgStats.totalRevenue)}</p>
    </div>
  </div>
  <div className="ap-stat-card">
    <div className="ap-stat-icon">
      <i className="fas fa-arrow-up"></i>
    </div>
    <div className="ap-stat-info">
      <h3>Total Expenses</h3>
      <p className="ap-stat-number">{formatCurrency(orgStats.totalExpenses)}</p>
    </div>
  </div>
</div>

      <div className="ap-users-section">
        <div className="ap-users-header">
          <h2><i className="fas fa-user-friends"></i> Team Members</h2>
          <div className="ap-filter-controls">
            <div className="ap-search-box">
              <i className="fas fa-search"></i>
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ap-search-input"
              />
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="ap-role-filter"
            >
              <option value="all">All Roles</option>
              <option value="owner">Owners</option>
              <option value="admin">Admins</option>
              <option value="manager">Managers</option>
              <option value="member">Members</option>
            </select>
          </div>
        </div>

        <div className="ap-table-wrapper">
          {loading ? (
            <div className="ap-loading">
              <div className="ap-spinner"></div>
              <p>Loading team members...</p>
            </div>
          ) : (
            <table className="ap-users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(user => (
                  <tr key={user.id} className={user.id === userProfile?.id ? 'ap-current-user-row' : ''}>
                    <td>
                      <div className="ap-user-info">
                        <div className="ap-user-avatar" style={{ background: `hsl(${user.name.charCodeAt(0) % 360}, 70%, 60%)` }}>
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <strong>{user.name}</strong>
                          {user.id === userProfile?.id && <span className="ap-current-badge">You</span>}
                        </div>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      {canManageUsers && user.id !== userProfile?.id ? (
                        <select
                          value={user.role}
                          onChange={(e) => updateUserRole(user.id, e.target.value)}
                          className={`ap-role-select ${getRoleBadgeClass(user.role)}`}
                          disabled={!isOwner && user.role === 'owner'}
                        >
                          <option value="member">Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                          {isOwner && <option value="owner">Owner</option>}
                        </select>
                      ) : (
                        <span className={getRoleBadgeClass(user.role)}>
                          <i className={`fas ${getRoleIcon(user.role)}`}></i>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </span>
                      )}
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                    <td>
                      {user.id !== userProfile?.id && (
                        <button
                          className="ap-action-btn"
                          onClick={() => removeUser(user.id)}
                          title="Remove user"
                          disabled={saving}
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && filteredUsers.length === 0 && (
            <div className="ap-empty">
              <i className="fas fa-user-slash"></i>
              <p>No users found matching your search</p>
            </div>
          )}
        </div>
      </div>

      {showInviteModal && (
        <div className="ap-modal-overlay" onClick={() => setShowInviteModal(false)}>
          <div className="ap-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="ap-modal-header">
              <div className="ap-modal-icon">
                <i className="fas fa-user-plus"></i>
              </div>
              <h2>Invite New Team Member</h2>
              <p>Send an invitation to join your organization</p>
              <button type="submit" className="ap-modal-close" onClick={() => setShowInviteModal(false)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <form onSubmit={handleInvite}>
              <div className="ap-modal-body">
                <div className="ap-form-group">
                  <label>Full Name</label>
                  <div className="ap-input-icon">
                    <i className="fas fa-user"></i>
                    <input
                      type="text"
                      value={inviteName}
                      onChange={(e) => setInviteName(e.target.value)}
                      placeholder="e.g., John Doe"
                      required
                    />
                  </div>
                </div>
                <div className="ap-form-group">
                  <label>Email Address</label>
                  <div className="ap-input-icon">
                    <i className="fas fa-envelope"></i>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                    />
                  </div>
                </div>
                <div className="ap-form-group">
                  <label>Role</label>
                  <div className="ap-input-icon">
                    <i className="fas fa-tag"></i>
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value)}
                    >
                      <option value="member">Member - View only</option>
                      <option value="manager">Manager - Can add/edit transactions</option>
                      <option value="admin">Admin - Can manage users</option>
                      {isOwner && <option value="owner">Owner - Full access</option>}
                    </select>
                  </div>
                  <p className="ap-role-desc">
                    {inviteRole === 'member' && 'Can view all financial data but cannot make changes.'}
                    {inviteRole === 'manager' && 'Can add and edit transactions, but cannot manage users.'}
                    {inviteRole === 'admin' && 'Can manage users and all financial data, but cannot change owner settings.'}
                    {inviteRole === 'owner' && 'Full control over the organization, including user management and settings.'}
                  </p>
                </div>
              </div>
              <div className="ap-modal-footer">
                <button type="button" className="ap-btn-secondary" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="ap-btn-primary">
                  <i className="fas fa-paper-plane"></i> Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}