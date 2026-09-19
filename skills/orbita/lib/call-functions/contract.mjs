export function callFunctionDefinition(functions, functionName) {
  const definition = functions instanceof Map ? functions.get(functionName) : functions?.[functionName];
  if (!definition) throw new Error(`unknown workflow call function '${functionName}'`);
  if (typeof definition.execute !== 'function') {
    throw new Error(`call function '${functionName}' does not define an executable implementation`);
  }
  return definition;
}

export function outputSchemaForCallStep(step, resources) {
  const definition = callFunctionDefinition(resources?.callFunctions, step.function);
  if (definition.output.kind === 'fixed') return { schema: definition.output.schema, schemaRef: `call-function:${definition.name}` };
  const schemaRef = step.output?.schema;
  if (!schemaRef) throw new Error(`call function '${definition.name}' requires step output.schema`);
  const loaded = resources?.outputSchemas instanceof Map
    ? resources.outputSchemas.get(schemaRef)
    : resources?.outputSchemas?.[schemaRef];
  const schema = loaded?.schema ?? loaded;
  if (!schema) throw new Error(`output schema validation failed: missing output.schema '${schemaRef}'`);
  return { schema, schemaRef };
}
