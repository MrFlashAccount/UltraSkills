import { callFunctionDefinition } from './contract.mjs';

export async function executeCallFunction(invocation, dependencies = {}) {
  const definition = callFunctionDefinition(dependencies.functions, invocation.functionName);
  return definition.execute(invocation, dependencies);
}
