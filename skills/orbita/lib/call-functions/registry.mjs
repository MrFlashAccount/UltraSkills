import { executeExec } from './exec.mjs';
import { executeJev } from './jev.mjs';
import { executeJs } from './js.mjs';
import { executeSh } from './sh.mjs';

const objectSchema = {
  type: 'object',
  additionalProperties: false,
};

const callDefinedOutput = { kind: 'call-defined' };
const jsonContentSchema = {
  oneOf: [
    { type: 'string' },
    { type: 'object' },
    { type: 'array' },
  ],
};
const jsonDescriptionSchema = {
  oneOf: [jsonContentSchema, { type: 'null' }],
};
const probabilitySchema = { type: 'number', minimum: 0, maximum: 1 };
const probabilityMapSchema = {
  type: 'object',
  minProperties: 1,
  additionalProperties: probabilitySchema,
};
const jevOutput = {
  kind: 'fixed',
  schema: {
    type: 'object',
    minProperties: 1,
    additionalProperties: {
      oneOf: [
        {
          type: 'object',
          required: ['type', 'probability'],
          properties: {
            type: { const: 'boolean' },
            probability: probabilitySchema,
          },
          additionalProperties: false,
        },
        {
          type: 'object',
          required: ['type', 'choice'],
          properties: {
            type: { const: 'choice' },
            choice: { type: 'string', minLength: 1 },
            probabilities: probabilityMapSchema,
          },
          additionalProperties: false,
        },
        {
          type: 'object',
          required: ['type', 'score'],
          properties: {
            type: { const: 'score' },
            score: { type: 'number', minimum: 0 },
            probabilities: probabilityMapSchema,
          },
          additionalProperties: false,
        },
      ],
    },
  },
};
const execOutput = {
  kind: 'fixed',
  schema: {
    type: 'object',
    required: ['exit_code', 'stdout', 'stderr'],
    properties: {
      exit_code: { type: 'integer', minimum: 0 },
      stdout: { type: 'string' },
      stderr: { type: 'string' },
    },
    additionalProperties: false,
  },
};

export const callFunctionDefinitions = {
  ask_jev: {
    name: 'ask_jev',
    parameters: {
      ...objectSchema,
      required: ['api_key_file', 'state', 'questions'],
      properties: {
        api_key_file: { type: 'string', minLength: 1 },
        state: jsonContentSchema,
        questions: {
          type: 'object',
          minProperties: 1,
          propertyNames: { minLength: 1 },
          additionalProperties: {
            oneOf: [
              {
                type: 'object',
                required: ['type', 'instructions'],
                properties: {
                  type: { const: 'boolean' },
                  instructions: jsonContentSchema,
                  criteria: {
                    type: 'object',
                    minProperties: 1,
                    properties: {
                      true: jsonDescriptionSchema,
                      false: jsonDescriptionSchema,
                    },
                    additionalProperties: false,
                  },
                },
                additionalProperties: false,
              },
              {
                type: 'object',
                required: ['type', 'instructions', 'criteria'],
                properties: {
                  type: { const: 'choice' },
                  instructions: jsonContentSchema,
                  criteria: {
                    type: 'object',
                    minProperties: 1,
                    additionalProperties: jsonDescriptionSchema,
                  },
                },
                additionalProperties: false,
              },
              {
                type: 'object',
                required: ['type', 'instructions', 'criteria'],
                properties: {
                  type: { const: 'score' },
                  instructions: jsonContentSchema,
                  criteria: {
                    type: 'array',
                    minItems: 2,
                    items: jsonDescriptionSchema,
                  },
                },
                additionalProperties: false,
              },
            ],
          },
        },
        timeout_ms: { type: 'integer', minimum: 1, maximum: 600000 },
      },
    },
    output: jevOutput,
    execute: executeJev,
  },
  sh: {
    name: 'sh',
    parameters: {
      ...objectSchema,
      required: ['script'],
      properties: {
        script: { type: 'string', minLength: 1 },
        input: {},
        timeout_ms: { type: 'integer', minimum: 1, maximum: 600000 },
      },
    },
    output: callDefinedOutput,
    execute: executeSh,
  },
  js: {
    name: 'js',
    parameters: {
      ...objectSchema,
      required: ['source'],
      properties: {
        source: { type: 'string', minLength: 1 },
        input: {},
        timeout_ms: { type: 'integer', minimum: 1, maximum: 600000 },
      },
    },
    output: callDefinedOutput,
    execute: executeJs,
  },
  exec: {
    name: 'exec',
    parameters: {
      ...objectSchema,
      required: ['executable'],
      properties: {
        executable: { type: 'string', minLength: 1 },
        args: { type: 'array', items: { type: 'string' } },
        cwd: { type: 'string', minLength: 1 },
        stdin: { type: 'string' },
        timeout_ms: { type: 'integer', minimum: 1, maximum: 600000 },
      },
    },
    output: execOutput,
    execute: executeExec,
  },
};
