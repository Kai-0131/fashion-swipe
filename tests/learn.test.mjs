import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { genreScores, bucketOf, genreWeight } from '../docs/js/learn.js';

const genres = JSON.parse(readFileSync('config/genres.json', 'utf8'));
const settings = { version: 1, likedGenres: ['cityboy'], maybeGenres: ['western'], suitColors: { near: [], far: [] }, slimPenalty: 0.3 };
let t = 0;
const sw = (verdict, gs) => ({ itemId: `i${t}`, kind: 'item', verdict, at: new Date(Date.UTC(2026, 10, 1, 0, 0, t++)).toISOString(), snapshot: { genres: gs } });

test('scores count like fav meh', () => {
  const s = genreScores([sw('like', ['a']), sw('fav', ['a']), sw('meh', ['a', 'b'])]);
  assert.equal(s.a.likes, 1);
  assert.equal(s.a.favs, 1);
  assert.equal(s.a.mehs, 1);
  assert.equal(s.a.score, 1 + 2 - 0.5);
  assert.equal(s.b.score, -0.5);
});

test('liked genre in settings is like bucket', () => {
  assert.equal(bucketOf('cityboy', {}, settings, genres), 'like');
});

test('neighbor is near', () => {
  assert.equal(bucketOf('minimal', {}, settings, genres), 'near');
});

test('maybeGenres from settings are maybe; two hops are challenge when the list exists', () => {
  assert.equal(bucketOf('western', {}, settings, genres), 'maybe');
  // cityboy -> skate -> tech-street: not listed, so a challenge
  assert.equal(bucketOf('tech-street', {}, settings, genres), 'challenge');
});

test('two hops are maybe when settings has no maybeGenres', () => {
  assert.equal(bucketOf('tech-street', {}, { ...settings, maybeGenres: [] }, genres), 'maybe');
});

test('others are challenge', () => {
  assert.equal(bucketOf('y2k', {}, settings, genres), 'challenge');
});

test('genre promoted after 3 likes with 60% recent rate', () => {
  const swipes = [sw('like', ['y2k']), sw('meh', ['y2k']), sw('like', ['y2k']), sw('fav', ['y2k'])];
  assert.equal(bucketOf('y2k', genreScores(swipes), settings, genres), 'like');
});

test('not promoted when recent rate is low', () => {
  const swipes = [sw('like', ['y2k']), sw('like', ['y2k']), sw('like', ['y2k']), ...Array.from({ length: 7 }, () => sw('meh', ['y2k']))];
  assert.equal(bucketOf('y2k', genreScores(swipes), settings, genres), 'challenge');
});

test('without settings everything is maybe unless promoted', () => {
  assert.equal(bucketOf('cityboy', {}, null, genres), 'maybe');
  assert.equal(bucketOf('y2k', {}, null, genres), 'maybe');
  const swipes = [sw('like', ['y2k']), sw('like', ['y2k']), sw('like', ['y2k'])];
  assert.equal(bucketOf('y2k', genreScores(swipes), null, genres), 'like');
});

test('meh lowers weight but never below 0.2', () => {
  assert.equal(genreWeight('a', {}), 1);
  assert.equal(genreWeight('a', genreScores([sw('meh', ['a'])])), 0.85);
  assert.equal(genreWeight('a', genreScores(Array.from({ length: 20 }, () => sw('meh', ['a'])))), 0.2);
});

test('collected photos count as likes for scoring', async () => {
  const { photoLikes } = await import('../docs/js/learn.js');
  const pseudo = photoLikes([{ id: 'p1', genres: ['y2k'] }, { id: 'p2', genres: ['y2k', 'mode'] }]);
  assert.equal(pseudo.length, 2);
  assert.equal(pseudo[0].itemId, 'mine:p1');
  assert.equal(pseudo[0].kind, 'mine');
  assert.equal(genreScores(pseudo).y2k.likes, 2);
});

test('collected photos do not promote a genre to like', async () => {
  const { photoLikes } = await import('../docs/js/learn.js');
  const pseudo = photoLikes(Array.from({ length: 5 }, (_, i) => ({ id: `p${i}`, genres: ['y2k'] })));
  assert.equal(bucketOf('y2k', genreScores(pseudo), settings, genres), 'challenge');
});

test('a 普通 swipe with a reason is about color or shape, not the genre', () => {
  const s = genreScores([
    { itemId: 'r1', kind: 'item', verdict: 'meh', at: '2026-11-19', snapshot: { genres: ['skate'] }, reasons: { color: -1 } },
    { itemId: 'r2', kind: 'item', verdict: 'meh', at: '2026-11-19', snapshot: { genres: ['skate'] } },
  ]);
  assert.equal(s.skate.mehs, 1);
  assert.deepEqual(s.skate.recent, [false]);
});
