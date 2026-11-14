import test from 'node:test';
import assert from 'node:assert/strict';
import { collectSourceLinks, sourceLabel } from './source-list.mjs';

test('lists each loaded source, fact, and record link exactly once', () => {
  const urls = collectSourceLinks({
    crops: {
      source: ['https://osdr.nasa.gov/search?term=plants'],
      crops: [{ factSource: 'https://www.nasa.gov/plants' }],
    },
    storms: { source: 'https://api.nasa.gov/DONKI', weeks: [{ events: [{ link: 'https://ccmc.gsfc.nasa.gov/DONKI/view/1' }] }] },
    photos: { photos: [{ url: 'https://images-assets.nasa.gov/image/1.jpg', page: 'https://images.nasa.gov/details/1' }] },
    terrain: { source: ['https://trek.nasa.gov/mars/'] },
  });
  assert.deepEqual(urls, [
    'https://api.nasa.gov/DONKI',
    'https://ccmc.gsfc.nasa.gov/DONKI/view/1',
    'https://images-assets.nasa.gov/image/1.jpg',
    'https://images.nasa.gov/details/1',
    'https://osdr.nasa.gov/search?term=plants',
    'https://trek.nasa.gov/mars/',
    'https://www.nasa.gov/plants',
  ]);
});

test('drops credentials, API keys, unsafe schemes, and non-source strings', () => {
  const urls = collectSourceLinks({
    source: ['https://api.nasa.gov/DONKI?api_key=secret&API_KEY=also-secret&startDate=2024-05-08', 'javascript:alert(1)', 'http://user:password@example.com/data'],
    title: 'https://not-a-source.example/path',
  });
  assert.deepEqual(urls, ['https://api.nasa.gov/DONKI?startDate=2024-05-08']);
  assert(!urls.some((url) => /secret|password/i.test(url)));
});

test('labels source links with their host and path', () => {
  assert.equal(sourceLabel('https://ccmc.gsfc.nasa.gov/DONKI/view/1?version=2'), 'ccmc.gsfc.nasa.gov/DONKI/view/1');
});
