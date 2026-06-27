import { useToastStore } from "@/stores/useToastStore";

export const toast = {
  success: (message: string, duration?: number) =>
    useToastStore.getState().add(message, "success", duration),
  error: (message: string, duration?: number) =>
    useToastStore.getState().add(message, "error", duration),
  info: (message: string, duration?: number) =>
    useToastStore.getState().add(message, "info", duration),
};
