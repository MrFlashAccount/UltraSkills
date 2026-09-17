import { executeExec } from './exec.mjs';
import { executeJs } from './js.mjs';
import { executeOpenAI } from './openai.mjs';
import { executeSh } from './sh.mjs';

const objectSchema = {
  type: 'object',
  additionalProperties: false,
};

const callDefinedOutput = { kind: 'call-defined' };
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
