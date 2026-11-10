import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/core.mjs';

const base = {
  schemaVersion: 1, name: 'typed-site', design: {preset:'editorial'},
  payments: {mode:'none'}, deploy: {provider:'static',tier:'preview'},
};
test('untrusted configuration rejects malformed nested values with a configuration error', () => {
  const malformed: unknown[] = [null, [], {...base, name: 123}, {...base, payments: []},
    {...base, deploy: null}, {...base, design: {preset:'editorial', template:123}},
    ...[null, false, [], {accent:123}, {event:[]}, {items:[null]},
      {items:[{name:'Example',category:'Test',description:'Content',url:123}]}].map(site => ({...base,site})),
    {...base, payments:{mode:'none', product:{amount:'1900',currency:'usd'}}},
  ];
  for (const input of malformed) assert.throws(() => validateConfig(input), {code:'INVALID_CONFIG'});
  assert.deepEqual(validateConfig(base), base);
});
