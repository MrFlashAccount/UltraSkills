import { isExpressionString, parsePathExpression } from '../runtime/expression.mjs';
import { readPath } from '../entities/Step/expressions/index.mjs';
import { formatSchemaErrors, validateJsonSchema } from '../../../../shared/scripts/schema-validation/schema-validation.mjs';

function resolveValue(value, input) {
  if (typeof value === 'string') {
    if (!isExpressionString(value)) return value;
    const expression = parsePathExpression(value, { allowedRoots: ['input'] });
    return readPath({ input }, expression);
  }
  if (Array.isArray(value)) return value.map((item) => resolveValue(item, input));
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, resolveValue(item, input)]));
}

export function resolveCallArguments(step, batonState) {
  return resolveValue(step.arguments, batonState ?? {});
}

export function validateCallArguments(definition, argumentsValue) {
  const validation = validateJsonSchema(definition.parameters, argumentsValue);
  if (!validation.ok) {
    throw new Error(`arguments for call function '${definition.name}' failed schema validation: ${formatSchemaErrors(validation.errors)}`);
  }
  return argumentsValue;
}
