import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiX,
  FiPlus,
  FiTrash2,
  FiUsers,
  FiPackage,
  FiDollarSign,
  FiActivity,
} from "react-icons/fi";
import { gatwayApi } from "../utils/axios";

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PlanItem {
  _id: string;
  name: string;
  description: string;
  price: number;
  credits: number;
  currency: string;
  isActive: boolean;
}

interface UserItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  credits: {
    balance: number;
    totalGranted: number;
    totalPurchased: number;
    totalConsumed: number;
  };
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<"plans" | "users" | "purchases" | "usage">("plans");

  // Plans state
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanDesc, setNewPlanDesc] = useState("");
  const [newPlanPriceRupees, setNewPlanPriceRupees] = useState("");
  const [newPlanCredits, setNewPlanCredits] = useState("");
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);

  // Users state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");

  // Purchases & Usage state
  const [purchases, setPurchases] = useState<any[]>([]);
  const [usages, setUsages] = useState<any[]>([]);

  // Feedback messages
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadTabContent();
    }
  }, [isOpen, activeTab]);

  const loadTabContent = async () => {
    setMsg(null);
    setErrorMsg(null);
    try {
      if (activeTab === "plans") {
        const res = await gatwayApi.get("/admin/plans");
        if (res.data.success) setPlans(res.data.data);
      } else if (activeTab === "users") {
        const res = await gatwayApi.get("/admin/users");
        if (res.data.success) setUsers(res.data.data);
      } else if (activeTab === "purchases") {
        const res = await gatwayApi.get("/admin/purchases");
        if (res.data.success) setPurchases(res.data.data);
      } else if (activeTab === "usage") {
        const res = await gatwayApi.get("/admin/usage");
        if (res.data.success) setUsages(res.data.data);
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to load data");
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErrorMsg(null);

    const priceInPaise = Math.round(Number(newPlanPriceRupees) * 100);
    const creditsNum = Number(newPlanCredits);

    if (!newPlanName || priceInPaise <= 0 || creditsNum <= 0) {
      setErrorMsg("Please fill in valid plan details");
      return;
    }

    try {
      const res = await gatwayApi.post("/admin/plans", {
        name: newPlanName,
        description: newPlanDesc,
        price: priceInPaise,
        credits: creditsNum,
        currency: "INR",
      });

      if (res.data.success) {
        setMsg("Plan created successfully!");
        setNewPlanName("");
        setNewPlanDesc("");
        setNewPlanPriceRupees("");
        setNewPlanCredits("");
        setIsCreatingPlan(false);
        loadTabContent();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to create plan");
    }
  };

  const handleTogglePlanActive = async (plan: PlanItem) => {
    try {
      const res = await gatwayApi.patch(`/admin/plans/${plan._id}`, {
        isActive: !plan.isActive,
      });
      if (res.data.success) {
        setMsg(`Plan ${plan.name} updated successfully`);
        loadTabContent();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to update plan");
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      const res = await gatwayApi.delete(`/admin/plans/${planId}`);
      if (res.data.success) {
        setMsg(res.data.message);
        loadTabContent();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to delete plan");
    }
  };

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setMsg(null);
    setErrorMsg(null);

    const amount = Number(adjustAmount);
    if (isNaN(amount) || amount === 0) {
      setErrorMsg("Please enter a valid non-zero adjustment amount");
      return;
    }

    try {
      const res = await gatwayApi.post(
        `/admin/users/${selectedUser._id}/credits/adjust`,
        {
          amount,
          description: adjustReason || "Admin manual adjustment",
        }
      );

      if (res.data.success) {
        setMsg(`Adjusted credits for ${selectedUser.name}!`);
        setSelectedUser(null);
        setAdjustAmount("");
        setAdjustReason("");
        loadTabContent();
      }
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Failed to adjust credits");
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-5xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#171923] border border-white/10 p-6 md:p-8 text-white shadow-2xl"
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white"
          >
            <FiX className="w-6 h-6" />
          </button>

          <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6">
            <div>
              <h2 className="text-2xl font-extrabold text-white">Admin Control Dashboard</h2>
              <p className="text-xs text-gray-400">Manage Plans, Users, Credits, Payments, & AI Usage</p>
            </div>
            {/* Tabs */}
            <div className="flex gap-2 bg-[#1e2028] p-1 rounded-xl border border-white/10 text-xs font-semibold">
              <button
                onClick={() => setActiveTab("plans")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  activeTab === "plans" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <FiPackage /> Plans
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  activeTab === "users" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <FiUsers /> Users
              </button>
              <button
                onClick={() => setActiveTab("purchases")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  activeTab === "purchases" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <FiDollarSign /> Payments
              </button>
              <button
                onClick={() => setActiveTab("usage")}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                  activeTab === "usage" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <FiActivity /> AI Usage
              </button>
            </div>
          </div>

          {msg && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
              {msg}
            </div>
          )}
          {errorMsg && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {/* TAB 1: PLANS */}
          {activeTab === "plans" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">Credit Plans</h3>
                <button
                  onClick={() => setIsCreatingPlan(!isCreatingPlan)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-bold"
                >
                  <FiPlus /> {isCreatingPlan ? "Cancel" : "Create New Plan"}
                </button>
              </div>

              {isCreatingPlan && (
                <form onSubmit={handleCreatePlan} className="mb-6 p-4 rounded-xl bg-[#1e2028] border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="text"
                    placeholder="Plan Name (e.g. Starter)"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Price in ₹ (e.g. 100)"
                    value={newPlanPriceRupees}
                    onChange={(e) => setNewPlanPriceRupees(e.target.value)}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Credits Granted (e.g. 200)"
                    value={newPlanCredits}
                    onChange={(e) => setNewPlanCredits(e.target.value)}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs"
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={newPlanDesc}
                    onChange={(e) => setNewPlanDesc(e.target.value)}
                    className="p-2.5 rounded-lg bg-black/40 border border-white/10 text-xs"
                  />
                  <button type="submit" className="md:col-span-2 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold">
                    Save Plan to MongoDB
                  </button>
                </form>
              )}

              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#1e2028] text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Credits</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {plans.map((p) => (
                      <tr key={p._id} className="hover:bg-white/5">
                        <td className="p-3 font-bold text-white">{p.name}</td>
                        <td className="p-3">₹{p.price / 100}</td>
                        <td className="p-3 font-semibold text-amber-400">{p.credits}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.isActive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="p-3 flex gap-2">
                          <button
                            onClick={() => handleTogglePlanActive(p)}
                            className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-[10px]"
                          >
                            {p.isActive ? "Deactivate" : "Activate"}
                          </button>
                          <button
                            onClick={() => handleDeletePlan(p._id)}
                            className="p-1 rounded bg-rose-500/20 hover:bg-rose-500/40 text-rose-400"
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: USERS */}
          {activeTab === "users" && (
            <div>
              <h3 className="text-lg font-bold mb-4">Users & Credit Accounts</h3>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#1e2028] text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Name / Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Balance</th>
                      <th className="p-3">Consumed</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map((u) => (
                      <tr key={u._id} className="hover:bg-white/5">
                        <td className="p-3">
                          <div className="font-bold text-white">{u.name}</div>
                          <div className="text-[10px] text-gray-400">{u.email}</div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.role === "admin" ? "bg-purple-500/20 text-purple-400" : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-amber-400">{u.credits?.balance || 0}</td>
                        <td className="p-3">{u.credits?.totalConsumed || 0}</td>
                        <td className="p-3">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-bold"
                          >
                            Adjust Credits
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Adjust Modal Form */}
              {selectedUser && (
                <form onSubmit={handleAdjustCredits} className="mt-6 p-4 rounded-xl bg-[#1e2028] border border-white/10 space-y-3">
                  <h4 className="font-bold text-sm">Adjust Credits for {selectedUser.name}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      type="number"
                      placeholder="Amount (+50 or -20)"
                      value={adjustAmount}
                      onChange={(e) => setAdjustAmount(e.target.value)}
                      className="p-2 rounded bg-black/40 border border-white/10 text-xs"
                      required
                    />
                    <input
                      type="text"
                      placeholder="Reason for adjustment"
                      value={adjustReason}
                      onChange={(e) => setAdjustReason(e.target.value)}
                      className="p-2 rounded bg-black/40 border border-white/10 text-xs"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-bold rounded">
                      Submit Adjustment
                    </button>
                    <button type="button" onClick={() => setSelectedUser(null)} className="px-4 py-2 bg-white/10 text-xs rounded">
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 3: PURCHASES */}
          {activeTab === "purchases" && (
            <div>
              <h3 className="text-lg font-bold mb-4">Payment & Order History</h3>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#1e2028] text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">User ID</th>
                      <th className="p-3">Amount</th>
                      <th className="p-3">Credits Granted</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Razorpay Order ID</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {purchases.map((p) => (
                      <tr key={p._id} className="hover:bg-white/5">
                        <td className="p-3 font-mono text-[10px] text-gray-400">{p.userId}</td>
                        <td className="p-3 font-bold text-white">₹{p.amount / 100}</td>
                        <td className="p-3 text-amber-400 font-semibold">{p.creditsGranted}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === "SUCCESS"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : p.status === "PENDING"
                                ? "bg-amber-500/20 text-amber-400"
                                : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-gray-400">{p.razorpayOrderId}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: USAGE */}
          {activeTab === "usage" && (
            <div>
              <h3 className="text-lg font-bold mb-4">AI Agent Execution Logs</h3>
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#1e2028] text-gray-400 uppercase font-semibold">
                    <tr>
                      <th className="p-3">Agent</th>
                      <th className="p-3">Credit Cost</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">User ID</th>
                      <th className="p-3">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {usages.map((u) => (
                      <tr key={u._id} className="hover:bg-white/5">
                        <td className="p-3 font-bold text-indigo-400">{u.agent}</td>
                        <td className="p-3 font-semibold text-amber-400">{u.creditCost}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.status === "success" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                            }`}
                          >
                            {u.status}
                          </span>
                        </td>
                        <td className="p-3 font-mono text-[10px] text-gray-400">{u.userId}</td>
                        <td className="p-3 text-[10px] text-gray-400">{new Date(u.createdAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default AdminDashboard;
