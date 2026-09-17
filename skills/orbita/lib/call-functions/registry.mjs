const objectSchema = {
  type: 'object',
  additionalProperties: false,
};

const callDefinedOutput = { kind: 'call-defined' };

export const callFunctionDefinitions = {
  ask_jeff: {
    name: 'ask_jeff',
    parameters: {
      ...objectSchema,
      required: ['model', 'api_key_file', 'prompt'],
      properties: {
        base_url: { type: 'string', minLength: 1 },
        model: { type: 'string', minLength: 1 },
        api_key_file: { type: 'string', minLength: 1 },
        prompt: { type: 'string', minLength: 1 },
        instructions: { type: 'string' },
        max_output_tokens: { type: 'integer', minimum: 1 },
        timeout_ms: { type: 'integer', minimum: 1, maximum: 600000 },
      },
    },
    output: callDefinedOutput,
    execute: executeOpenAI,
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
};
import { executeJs } from './js.mjs';
import { executeOpenAI } from './openai.mjs';
import { executeSh } from './sh.mjs';
