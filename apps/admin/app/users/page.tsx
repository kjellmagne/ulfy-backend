"use client";

import { useEffect, useState } from "react";
import { Building2, Plus, Save, Trash2, UserRound, Users } from "lucide-react";
import { RequireAuth } from "../../components/RequireAuth";
import { Alert, EmptyState, FieldLabel, LoadingPanel, Modal, PageHeader, PanelHeader, StatCard, StatusBadge } from "../../components/AdminUI";
import { api } from "../../lib/api";

const emptyUser = {
  email: "",
  fullName: "",
  role: "partner_admin",
  partnerId: "",
  password: ""
};

const emptyPartner = {
  name: "",
  email: "",
  notes: ""
};

export default function UsersPage() {
  const [me, setMe] = useState<any>();
  const [users, setUsers] = useState<any[]>([]);
  const [partners, setPartners] = useState<any[]>([]);
  const [userForm, setUserForm] = useState<any>(emptyUser);
  const [partnerForm, setPartnerForm] = useState<any>(emptyPartner);
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [partnerModalOpen, setPartnerModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");

  async function load() {
    try {
      const current = await api("/admin/me");
      setMe(current);
      if (current.role !== "superadmin") return;
      const [userData, partnerData] = await Promise.all([api("/admin/users"), api("/admin/partners")]);
      setUsers(userData);
      setPartners(partnerData);
      setUserForm((value: any) => ({ ...value, partnerId: value.partnerId || partnerData[0]?.id || "" }));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load().catch(console.error); }, []);

  function createUser() {
    setSelectedUser("");
    setUserForm({ ...emptyUser, partnerId: partners[0]?.id || "" });
    setError("");
    setUserModalOpen(true);
  }

  function editUser(user: any) {
    setSelectedUser(user.id);
    setUserForm({ email: user.email, fullName: user.fullName, role: user.role, partnerId: user.partnerId ?? "", password: "" });
    setError("");
    setUserModalOpen(true);
  }

  async function saveUser(event: React.FormEvent) {
    event.preventDefault();
    setSaving("user");
    setError("");
    try {
      const payload: any = {
        email: userForm.email,
        fullName: userForm.fullName,
        role: userForm.role,
        partnerId: userForm.partnerId || null
      };
      if (userForm.password) payload.password = userForm.password;
      await api(selectedUser ? `/admin/users/${selectedUser}` : "/admin/users", { method: selectedUser ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(selectedUser ? "User updated" : "User created");
      setUserModalOpen(false);
      setSelectedUser("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  async function deleteUser(user: any) {
    if (!window.confirm(`Delete ${user.fullName}? This cannot be undone.`)) return;
    setError("");
    try {
      await api(`/admin/users/${user.id}`, { method: "DELETE" });
      setMessage("User deleted");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function createPartner() {
    setSelectedPartner("");
    setPartnerForm(emptyPartner);
    setError("");
    setPartnerModalOpen(true);
  }

  function editPartner(partner: any) {
    setSelectedPartner(partner.id);
    setPartnerForm({ name: partner.name ?? "", email: partner.email ?? "", notes: partner.notes ?? "" });
    setError("");
    setPartnerModalOpen(true);
  }

  async function savePartner(event: React.FormEvent) {
    event.preventDefault();
    setSaving("partner");
    setError("");
    const payload = Object.fromEntries(Object.entries(partnerForm).map(([key, value]) => [key, value === "" ? undefined : value]));
    try {
      await api(selectedPartner ? `/admin/partners/${selectedPartner}` : "/admin/partners", { method: selectedPartner ? "PATCH" : "POST", body: JSON.stringify(payload) });
      setMessage(selectedPartner ? "Partner updated" : "Partner created");
      setPartnerModalOpen(false);
      setSelectedPartner("");
      await load();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  async function deletePartner(partner: any) {
    if (!window.confirm(`Delete ${partner.name}? This only works when nothing references the partner.`)) return;
    setError("");
    try {
      await api(`/admin/partners/${partner.id}`, { method: "DELETE" });
      setMessage("Partner deleted");
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (loading) {
    return (
      <RequireAuth>
        <LoadingPanel label="Loading admin users" />
      </RequireAuth>
    );
  }

  if (me?.role !== "superadmin") {
    return (
      <RequireAuth>
        <PageHeader title="Users" description="Admin portal users and solution partner access." />
        <Alert tone="danger">Only superadmins can manage admin portal users and solution partners.</Alert>
      </RequireAuth>
    );
  }

  const superadmins = users.filter(u => u.role === 'superadmin').length;
  const partnerAdmins = users.filter(u => u.role === 'partner_admin').length;

  return (
    <RequireAuth>
      <PageHeader title="Users" description="Manage internal admin users, solution partners, and partner access to tenants, licenses, and configs." meta={message && <span className="badge status-active">{message}</span>} />
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="page-stack">
        {/* Stats */}
        <div className="grid three">
          <StatCard label="Total users" value={users.length} icon={<Users size={18} />} sub={`${superadmins} superadmins`} />
          <StatCard label="Partner admins" value={partnerAdmins} icon={<UserRound size={18} />} sub="with partner scope" />
          <StatCard label="Partners" value={partners.length} icon={<Building2 size={18} />} sub="solution partners" />
        </div>

        <div className="panel">
          <PanelHeader title="Admin portal users" description="Partner admins inherit access from their assigned solution partner." actions={<button type="button" className="button" onClick={createUser}><Plus size={16} /> New user</button>} />
          {!users.length ? <EmptyState title="No admin users" message="Create the first partner or staff user." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>User</th><th>Role</th><th>Partner access</th><th>Created</th><th className="actions">Actions</th></tr></thead>
                <tbody>{users.map((user) => (
                  <tr key={user.id}>
                    <td><b>{user.fullName}</b><br /><span className="muted">{user.email}</span></td>
                    <td><StatusBadge status={user.role.replace("_", " ")} /></td>
                    <td>{user.partner?.name ?? <span className="muted">All tenants / internal</span>}</td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td className="row actions"><button type="button" className="button secondary" onClick={() => editUser(user)}><UserRound size={14} /> Edit</button><button type="button" className="button danger" onClick={() => deleteUser(user)}><Trash2 size={14} /> Delete</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
        <div className="panel">
          <PanelHeader title="Solution partners" description="Assign tenants and partner admins to the same partner to grant access." actions={<button type="button" className="button" onClick={createPartner}><Plus size={16} /> New partner</button>} />
          {!partners.length ? <EmptyState title="No partners" message="Create a partner before adding partner admin users." /> : (
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Partner</th><th>Email</th><th>Access</th><th>Notes</th><th className="actions">Actions</th></tr></thead>
                <tbody>{partners.map((partner) => (
                  <tr key={partner.id}>
                    <td><b>{partner.name}</b></td>
                    <td>{partner.email ?? "-"}</td>
                    <td><b>{partner.admins?.length ?? 0}</b> users / <b>{partner.tenants?.length ?? 0}</b> tenants</td>
                    <td><span className="muted">{partner.notes ?? "-"}</span></td>
                    <td className="row actions"><button type="button" className="button secondary" onClick={() => editPartner(partner)}><Building2 size={14} /> Edit</button><button type="button" className="button danger" onClick={() => deletePartner(partner)}><Trash2 size={14} /> Delete</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Modal
        open={userModalOpen}
        title={selectedUser ? "Edit admin user" : "Create admin user"}
        description="Partner admins can only access tenants, licenses, and configs assigned to their solution partner."
        onClose={() => saving !== "user" && setUserModalOpen(false)}
        footer={(
          <>
            <button type="button" className="button secondary" onClick={() => setUserModalOpen(false)} disabled={saving === "user"}>Cancel</button>
            <button type="submit" form="admin-user-form" className="button" disabled={saving === "user"}><Save size={16} /> {saving === "user" ? "Saving..." : "Save user"}</button>
          </>
        )}
      >
        <form id="admin-user-form" onSubmit={saveUser}>
          <div className="grid two">
            <div className="field"><FieldLabel>Full name</FieldLabel><input className="input" value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} required /></div>
            <div className="field"><FieldLabel>Email</FieldLabel><input className="input" type="email" value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} required /></div>
            <div className="field"><FieldLabel>Role</FieldLabel><select value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}><option value="partner_admin">partner_admin</option><option value="staff_admin">staff_admin</option><option value="superadmin">superadmin</option></select></div>
            <div className="field"><FieldLabel help="Required for partner admins. Tenants assigned to this partner become visible to that user.">Solution partner</FieldLabel><select value={userForm.partnerId} onChange={(e) => setUserForm({ ...userForm, partnerId: e.target.value })}><option value="">None / internal</option>{partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name}</option>)}</select></div>
            <div className="field"><FieldLabel>{selectedUser ? "New password" : "Password"}</FieldLabel><input className="input" type="password" placeholder={selectedUser ? "Leave blank to keep current password" : "Minimum 8 characters"} value={userForm.password} onChange={(e) => setUserForm({ ...userForm, password: e.target.value })} required={!selectedUser} /></div>
          </div>
        </form>
      </Modal>
      <Modal
        open={partnerModalOpen}
        title={selectedPartner ? "Edit solution partner" : "Create solution partner"}
        description="Partners group users, tenants, license keys, and partner-managed config profiles."
        onClose={() => saving !== "partner" && setPartnerModalOpen(false)}
        footer={(
          <>
            <button type="button" className="button secondary" onClick={() => setPartnerModalOpen(false)} disabled={saving === "partner"}>Cancel</button>
            <button type="submit" form="partner-form" className="button" disabled={saving === "partner"}><Save size={16} /> {saving === "partner" ? "Saving..." : "Save partner"}</button>
          </>
        )}
      >
        <form id="partner-form" onSubmit={savePartner}>
          <div className="field"><FieldLabel>Name</FieldLabel><input className="input" placeholder="Nordic Solutions AS" value={partnerForm.name} onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })} required /></div>
          <div className="field"><FieldLabel>Email</FieldLabel><input className="input" type="email" placeholder="partner@example.no" value={partnerForm.email} onChange={(e) => setPartnerForm({ ...partnerForm, email: e.target.value })} /></div>
          <div className="field"><FieldLabel>Notes</FieldLabel><textarea placeholder="Internal notes about this partner" value={partnerForm.notes} onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })} /></div>
        </form>
      </Modal>
    </RequireAuth>
  );
}
