import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiCheck, FiZap, FiShield, FiCreditCard } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { fetchPlans, type PlanData } from "../features/plan/planSlice";
import { fetchCreditBalance } from "../features/credit/creditSlice";
import { gatwayApi } from "../utils/axios";

interface PlansModalProps {
  isOpen: boolean;
  onClose: () => void;
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const PlansModal: React.FC<PlansModalProps> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const { plans, loading: plansLoading } = useAppSelector((state) => state.plan);
  const { account } = useAppSelector((state) => state.credit);
  const { user } = useAppSelector((state) => state.auth);

  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      dispatch(fetchPlans());
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [isOpen, dispatch]);

  const handleBuyPlan = async (plan: PlanData) => {
    setPurchasingPlanId(plan._id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      // 1. Create Razorpay order via backend (backend loads trusted plan from MongoDB)
      const { data } = await gatwayApi.post("/payments/create-order", {
        planId: plan._id,
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to create payment order");
      }

      const { orderId, amount, currency, key } = data.data;

      // 2. Ensure Razorpay Checkout script is loaded
      const isLoaded = await loadRazorpayScript();
      if (!isLoaded && key && !key.includes("dummy")) {
        throw new Error("Razorpay SDK failed to load. Check network connection.");
      }

      // 3. Setup Razorpay Checkout options
      const options = {
        key: key || import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_RIcvaGeQNxmtd6",
        amount,
        currency: currency || "INR",
        name: "OmniMindAI",
        description: `${plan.name} - ${plan.credits} AI Credits`,
        order_id: orderId,
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          try {
            // 4. Server-side payment verification
            const verifyRes = await gatwayApi.post("/payments/verify", {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });

            if (verifyRes.data.success) {
              setSuccessMessage(
                `Payment Successful! Added ${plan.credits} credits to your account.`
              );
              dispatch(fetchCreditBalance());
            } else {
              setErrorMessage(
                verifyRes.data.message || "Payment verification failed"
              );
            }
          } catch (err: any) {
            setErrorMessage(
              err.response?.data?.message || "Failed to verify payment with server"
            );
          } finally {
            setPurchasingPlanId(null);
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
        },
        theme: {
          color: "#6366f1",
        },
        modal: {
          ondismiss: () => {
            setPurchasingPlanId(null);
          },
        },
      };

      if (window.Razorpay) {
        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Fallback simulation for local development without live Razorpay SDK
        const fakePaymentId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const fakeSig = `sig_${orderId}`;

        const verifyRes = await gatwayApi.post("/payments/verify", {
          razorpay_order_id: orderId,
          razorpay_payment_id: fakePaymentId,
          razorpay_signature: fakeSig,
        });

        if (verifyRes.data.success) {
          setSuccessMessage(
            `Payment Simulated Successfully! Added ${plan.credits} credits to your account.`
          );
          dispatch(fetchCreditBalance());
        }
        setPurchasingPlanId(null);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage(
        err.response?.data?.message || err.message || "Failed to initiate payment"
      );
      setPurchasingPlanId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-[#171923] border border-white/10 p-6 md:p-8 text-white shadow-2xl"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          >
            <FiX className="w-6 h-6" />
          </button>

          {/* Header */}
          <div className="text-center max-w-xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-xs font-semibold mb-3">
              <FiZap /> OmniMindAI AI Credits & Plans
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-gray-200 to-indigo-300 bg-clip-text text-transparent">
              Power Your Multi-Agent Workflows
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              Current Balance:{" "}
              <span className="font-bold text-amber-400">
                {account ? account.balance : 0} AI Credits
              </span>
            </p>
          </div>

          {/* Messages */}
          {errorMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm text-center">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mb-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm text-center font-medium">
              {successMessage}
            </div>
          )}

          {/* Plans Grid */}
          {plansLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              No plans available at the moment. Admin can create plans from the database/admin API.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const priceInRupees = plan.price / 100;
                const isPurchasing = purchasingPlanId === plan._id;

                return (
                  <div
                    key={plan._id}
                    className="relative flex flex-col justify-between rounded-2xl bg-[#1e2028]/80 border border-white/10 hover:border-indigo-500/50 p-6 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 group"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-xl font-bold text-white group-hover:text-indigo-400 transition-colors">
                          {plan.name}
                        </h3>
                        <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold">
                          {plan.credits} Credits
                        </span>
                      </div>

                      <p className="text-xs text-gray-400 min-h-[36px] mb-6">
                        {plan.description || "Get extra AI Credits for your OmniMindAI agents."}
                      </p>

                      <div className="mb-6">
                        <span className="text-3xl font-extrabold text-white">
                          ₹{priceInRupees}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">one-time</span>
                      </div>

                      <ul className="space-y-2.5 text-xs text-gray-300 mb-6">
                        <li className="flex items-center gap-2">
                          <FiCheck className="text-emerald-400" /> Instant Credit Allocation
                        </li>
                        <li className="flex items-center gap-2">
                          <FiCheck className="text-emerald-400" /> Never Expires
                        </li>
                        <li className="flex items-center gap-2">
                          <FiCheck className="text-emerald-400" /> Secure Razorpay Payment
                        </li>
                      </ul>
                    </div>

                    <button
                      disabled={isPurchasing}
                      onClick={() => handleBuyPlan(plan)}
                      className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/25 transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isPurchasing ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <FiCreditCard /> Buy {plan.credits} Credits
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer Security Badge */}
          <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-center gap-2 text-xs text-gray-500">
            <FiShield className="text-indigo-400" /> Secure 256-bit Encrypted Razorpay Test Payments
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default PlansModal;
