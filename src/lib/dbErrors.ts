export function databaseError(operation: string, error: unknown): Error {
  return new Error(`${operation}: ${String(error)}`);
}

export function isSchemaMigrationError(error: unknown): boolean {
  const msg = String(error).toLowerCase();
  return (
    msg.includes("has no column named") ||
    msg.includes("no such column") ||
    msg.includes("no such table")
  );
}
