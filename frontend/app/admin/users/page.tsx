"use client";

import React, { useState, useEffect } from "react";
import { 
  Users, 
  UserPlus, 
  ShieldCheck, 
  Wrench, 
  Building2, 
  User, 
  Loader2, 
  X, 
  Check, 
  AlertTriangle,
  Lock,
  Mail
} from "lucide-react";

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: "citizen" | "officer" | "worker" | "admin";
  departmentId?: string | null;
  active: boolean;
  department?: { name: string; code: string } | null;
  createdAt: string;
}

interface DeptItem {
  id: string;
  name: string;
  code: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "Password123!",
    role: "officer",
    departmentId: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, deptRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/admin/departments"),
      ]);

      const usersData = await usersRes.json();
      const deptData = await deptRes.json();

      if (usersData.users) setUsers(usersData.users);
      if (deptData.departments) {
        setDepartments(deptData.departments);
        if (deptData.departments[0]) {
          setFormData((prev) => ({ ...prev, departmentId: deptData.departments[0].id }));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Failed to create staff member.");
      } else {
        setCreateOpen(false);
        setFormData({
          name: "",
          email: "",
          password: "Password123!",
          role: "officer",
          departmentId: departments[0]?.id || "",
        });
        fetchData();
      }
    } catch {
      setErrorMessage("Network error creating user.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !user.active }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Cannot modify user");
      } else {
        fetchData();
      }
    } catch {
      alert("Request failed");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Municipal User & Staff Directory
          </h1>
          <p className="text-xs text-slate-500">
            Provision departmental officers, field workers, and administrators
          </p>
        </div>

        <button
          onClick={() => setCreateOpen(true)}
          className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Staff Member</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading user accounts...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Name</th>
                  <th className="py-3.5 px-4">Email</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {u.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {u.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] capitalize ${
                        u.role === "admin"
                          ? "bg-indigo-100 text-indigo-800"
                          : u.role === "officer"
                          ? "bg-teal-100 text-[#0D7377]"
                          : u.role === "worker"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {u.department ? u.department.name : "—"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        u.active ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                      }`}>
                        {u.active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {u.role !== "admin" ? (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`text-xs font-bold hover:underline ${
                            u.active ? "text-rose-600" : "text-emerald-700"
                          }`}
                        >
                          {u.active ? "Deactivate" : "Activate"}
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">Protected Admin</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Provision Staff Account</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Asim Raza"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. asim.wasa@civicfix.gov.pk"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Role</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                >
                  <option value="officer">Department Officer (Reviews & Assigns)</option>
                  <option value="worker">Field Worker (Uploads Proof & Fixes)</option>
                  <option value="admin">System Administrator</option>
                </select>
              </div>

              {formData.role !== "admin" && (
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Department</label>
                  <select
                    value={formData.departmentId}
                    onChange={(e) => setFormData({ ...formData, departmentId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 font-bold"
                  >
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">Default Password</label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="font-bold text-slate-600 px-3 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-[#0D7377] hover:bg-[#095256] text-white font-bold py-2.5 px-4 rounded-xl shadow-xs"
                >
                  {submitting ? "Creating..." : "Save Staff Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
