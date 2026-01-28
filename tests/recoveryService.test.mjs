import test from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcryptjs';

import { RecoveryService } from '../dist/services/recoveryService.js';

test('RecoveryService.consume finds matching code and marks used', async () => {
  const code = 'RC-ABCD-EFGH';
  const hash = bcrypt.hashSync(code, 12);
  const fakeRow = { id: 7, code_hash: hash };

  let consumed = false;
  const storage = {
    consumeRecoveryCode: async (user_id, code_hash) => {
      consumed = true;
      assert.strictEqual(code_hash, hash);
      return true;
    },
    addRecoveryCodes: async () => {}
  };

  const service = new RecoveryService(storage, async (user_id) => [fakeRow]);
  const ok = await service.consume(1, code);
  assert.ok(ok === true);
  assert.ok(consumed, 'consumeRecoveryCode called');
});
