import Ajv2020 from './vendor/ajv.mjs';

/**
 * Validate a value against a JSON Schema with optional referenced schemas.
 *
 * The schema documents remain the source of truth; callers pass the schema
 * object they want checked at runtime instead of importing generated validators.
 */
function createAjv() {
  const ajv = new Ajv2020({ allErrors: true });
  ajv.addKeyword({ keyword: 'x-usage' });
  return ajv;
}

const schemaObjectIds = new WeakMap();
const validatorCache = new WeakMap();
let nextSchemaObjectId = 1;

function schemaObjectKey(schema) {
  if (!schema || typeof schema !== 'object') return String(schema);
  if (typeof schema.$id === 'string' && schema.$id.length > 0) return `id:${schema.$id}`;
  let id = schemaObjectIds.get(schema);
  if (!id) {
    id = nextSchemaObjectId;
    nextSchemaObjectId += 1;
    schemaObjectIds.set(schema, id);
  }
  return `object:${id}`;
}

function validatorCacheKey(schemas = []) {
  return schemas.map(schemaObjectKey).join('\u001f');
}

export class SchemaValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SchemaValidationError';
  }
}

export function formatSchemaErrors(errors = []) {
  return errors
    .map((error) => `${error.instancePath || '/'} ${error.message}`.trim())
    .join('; ');
}

export function validateJsonSchema(schema, value, options = {}) {
  const schemas = options.schemas ?? [];
  const cacheKey = validatorCacheKey(schemas);
  const canCacheSchema = schema && typeof schema === 'object';
  let validatorsForSchema = canCacheSchema ? validatorCache.get(schema) : undefined;
  let validate = validatorsForSchema?.get(cacheKey);

  if (!validate) {
    const ajv = createAjv();
    const loadedSchemaIds = new Set();

    for (const referencedSchema of schemas) {
      const schemaId = referencedSchema?.$id;
      if (schemaId && loadedSchemaIds.has(schemaId)) continue;
      ajv.addSchema(referencedSchema);
      if (schemaId) loadedSchemaIds.add(schemaId);
    }

    validate = schema?.$id ? (ajv.getSchema(schema.$id) ?? ajv.compile(schema)) : ajv.compile(schema);
    if (canCacheSchema) {
      validatorsForSchema ??= new Map();
      validatorsForSchema.set(cacheKey, validate);
      validatorCache.set(schema, validatorsForSchema);
    }
  }
  const ok = validate(value);
  return {
    ok,
    errors: validate.errors ?? [],
  };
}

export function compileJsonSchema(schema, { schemas = [] } = {}) {
  return validateJsonSchema(schema, {}, { schemas });
}

export function assertJsonSchema(schema, value, name, { schemas = [] } = {}) {
  const validation = validateJsonSchema(schema, value, { schemas });
  if (!validation.ok) throw new SchemaValidationError(`${name} failed schema validation: ${formatSchemaErrors(validation.errors)}`);
}
