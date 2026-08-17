import React, { useEffect } from "react";
import { FiZap } from "react-icons/fi";
import { useAppDispatch, useAppSelector } from "../hooks/redux";
import { fetchCreditBalance } from "../features/credit/creditSlice";

interface CreditBadgeProps {
  onOpenPlans: () => void;
}

const CreditBadge: React.FC<CreditBadgeProps> = ({ onOpenPlans }) => {
  const dispatch = useAppDispatch();
  const { account, loading } = useAppSelector((state) => state.credit);
  const { isAuthenticated } = useAppSelector((state) => state.auth);

  useEffect(() => {
    if (isAuthenticated) {
      dispatch(fetchCreditBalance());
    }
  }, [dispatch, isAuthenticated]);

  const balance = account ? account.balance : 0;

  return (
    <button
      onClick={onOpenPlans}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 border border-amber-500/30 text-amber-500 hover:scale-105 hover:border-amber-400 transition-all duration-200 shadow-md backdrop-blur-md cursor-pointer group"
      title="Click to Buy AI Credits / View Plans"
    >
      <FiZap className="w-4 h-4 text-amber-400 animate-pulse group-hover:scale-125 transition-transform" />
      <span className="text-xs font-bold tracking-wide">
        {loading && account === null ? "..." : `${balance} AI Credits`}
      </span>
      <span className="text-[10px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-extrabold uppercase ml-1">
        Buy
      </span>
    </button>
  );
};

export default CreditBadge;
