import { create } from "zustand";

export type ToastType = "success" | "error" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type: ToastType, duration?: number) => void;
  dismiss: (id: string) => void;
}

let _idCounter = 0;

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (message, type, duration = 2500) => {
    const id = `toast-${++_idCounter}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
