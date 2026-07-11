import { WorkflowRuntimeError } from '../errors.mjs';

export function normalizeCursor(cursor) {
  if (typeof cursor !== 'string' || cursor.length === 0) {
    throw new WorkflowRuntimeError('baton cursor must be a non-empty workflow step id');
  }
  return cursor;
}
