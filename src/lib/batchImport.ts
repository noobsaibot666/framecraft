/** Pure helpers for batch prompt import outcome reporting. */

export interface BatchFailure {
  title: string;
  error: string;
}

export interface BatchOutcome {
  total: number;
  succeeded: number;
  failures: BatchFailure[];
}

/** True only when every item imported successfully. */
export function batchFullySucceeded(outcome: BatchOutcome): boolean {
  return outcome.total > 0 && outcome.failures.length === 0 && outcome.succeeded === outcome.total;
}

/** Human-readable one-line summary of a batch import run. */
export function summarizeBatchOutcome(outcome: BatchOutcome): string {
  const { total, succeeded, failures } = outcome;
  if (total === 0) return "Nothing to import.";
  if (failures.length === 0) {
    return `Imported all ${succeeded} prompt${succeeded !== 1 ? "s" : ""}.`;
  }
  if (succeeded === 0) {
    return `Import failed — 0 of ${total} saved. First error: ${failures[0].error}`;
  }
  return `Imported ${succeeded} of ${total}. ${failures.length} failed (e.g. "${failures[0].title}": ${failures[0].error}).`;
}
