const redactedControlTerms = [
  'next',
  'continue',
  ['write', 'output'].join('-'),
  ['bind', 'agent'].join('-'),
  'retry',
  'rerun',
  'repair',
  'move',
  'drag',
  'drop',
];
const redactedControlPattern = new RegExp(`\\b(?:${redactedControlTerms.join('|')})\\b`, 'gi');

export function redactControlText(value: string) {
  return value.replace(redactedControlPattern, 'control action');
}
