import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeLine, parseJudgments } from '../tools/judging.mjs';

const genreIds = ['skate', 'minimal', 'y2k', 'cityboy'];

test('judgeLine puts brand, title, type and a few tags on one tab-separated line', () => {
  const line = judgeLine(7, { brand: 'Stüssy', title: 'Big\tLogo Tee', productType: 'Tops', tags: ['a', 'b', 'c', 'd', 'e', 'f', 'g'], shopName: 'Stüssy' });
  assert.equal(line, '7\tStüssy\tBig Logo Tee\tTops\ta,b,c,d,e,f\tStüssy');
});

test('parseJudgments reads genres and kind, or x for not fashion', () => {
  const ids = ['id0', 'id1', 'id2'];
  const { judgments, errors } = parseJudgments('0\tskate,y2k\ttop\n1\tx\n2\tminimal\taccessory\n', ids, genreIds);
  assert.deepEqual(errors, []);
  assert.deepEqual(judgments, { id0: { g: ['skate', 'y2k'], k: 'top' }, id1: { x: 1 }, id2: { g: ['minimal'], k: 'accessory' } });
});

test('parseJudgments rejects unknown genres, unknown kinds, bad numbers and more than 3 genres', () => {
  const ids = ['id0', 'id1', 'id2', 'id3'];
  const { judgments, errors } = parseJudgments('0\tgoth\ttop\n1\tskate\thatwear\n9\tskate\ttop\n2\tskate,minimal,y2k,cityboy\ttop\n3\tskate\tbottom', ids, genreIds);
  assert.deepEqual(judgments, { id3: { g: ['skate'], k: 'bottom' } });
  assert.equal(errors.length, 4);
});
