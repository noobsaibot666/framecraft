import { create } from "zustand";
import type { DashboardStats } from "@/types";
import { getDashboardStats } from "@/lib/db";

interface DashboardState {
  stats: DashboardStats;
  loading: boolean;
  fetchStats: () => Promise<void>;
}

const empty: DashboardStats = {
  total_prompts: 0,
  total_results: 0,
  total_recipes: 0,
  total_winners: 0,
  recent_prompts: [],
  top_rated: [],
};

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: empty,
  loading: false,

  fetchStats: async () => {
    set({ loading: true });
    try {
      const stats = await getDashboardStats();
      set({ stats, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
