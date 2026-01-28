import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';

import { LinkService } from '../dist/services/linkService.js';

test('LinkService.verifyAndConsume matches token and calls storage.consumeLinkToken', async () => {
  const plain = 'MYTOKEN123';
  const tokenHash = bcrypt.hashSync(plain, 12);
  const fakeRow = { id: 1, token_hash: tokenHash, user_id: 42 };

  let consumedCalled = false;
  const storage = {
    consumeLinkToken: async (hash) => {
      consumedCalled = true;
      assert.strictEqual(hash, tokenHash);
      return { id: 1, user_id: 42 };
    }
  };

  const service = new LinkService(storage, async () => [fakeRow]);
  const res = await service.verifyAndConsume(plain);
  assert.ok(consumedCalled, 'consumeLinkToken was called');
  assert.ok(res && res.user_id === 42);
});
