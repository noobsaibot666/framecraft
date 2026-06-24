import { create } from "zustand";
import type { Prompt, LibraryFilters, SortOption } from "@/types";
import {
  getPrompts,
  getPromptById,
  createPrompt,
  updatePrompt,
  deletePrompt,
  searchPrompts,
  type CreatePromptInput,
} from "@/lib/db";
import { filterAndSortPrompts, type ResultSummaryMap } from "@/lib/promptFilters";

interface PromptState {
  prompts: Prompt[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  filters: LibraryFilters;
  sortBy: SortOption;

  fetchPrompts: () => Promise<void>;
  search: (query: string) => Promise<void>;
  setFilters: (f: Partial<LibraryFilters>) => void;
  setSortBy: (s: SortOption) => void;
  getById: (id: string) => Promise<Prompt | null>;
  create: (data: CreatePromptInput) => Promise<string>;
  update: (id: string, data: Partial<CreatePromptInput>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  filteredAndSorted: (resultSummary?: ResultSummaryMap) => Prompt[];
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  loading: false,
  error: null,
  searchQuery: "",
  filters: {},
  sortBy: "newest",

  fetchPrompts: async () => {
    set({ loading: true, error: null });
    try {
      const prompts = await getPrompts();
      set({ prompts, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  search: async (query: string) => {
    set({ searchQuery: query, loading: true });
    try {
      const prompts = await searchPrompts(query);
      set({ prompts, loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),

  setSortBy: (sortBy) => set({ sortBy }),

  getById: async (id) => {
    const local = get().prompts.find((p) => p.id === id);
    if (local) return local;
    return getPromptById(id);
  },

  create: async (data) => {
    const id = await createPrompt(data);
    await get().fetchPrompts();
    return id;
  },

  update: async (id, data) => {
    await updatePrompt(id, data);
    await get().fetchPrompts();
  },

  remove: async (id) => {
    await deletePrompt(id);
    set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }));
  },

  filteredAndSorted: (resultSummary) => {
    const { prompts, filters, sortBy } = get();
    return filterAndSortPrompts(prompts, filters, sortBy, resultSummary);
  },
}));
