import runAuthoritySchema from './run-authority.json' with { type: 'json' };
import { assertJsonSchema } from '../../../../../../shared/scripts/schema-validation/schema-validation.mjs';

export { runAuthoritySchema };

export function assertRunAuthoritySchema(authority) {
  assertJsonSchema(runAuthoritySchema, authority, 'run authority', { schemas: [runAuthoritySchema] });
}
