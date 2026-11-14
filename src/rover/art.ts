import Phaser from 'phaser';
import { pixelTexture } from '../art/pixel';

// Top-down rover (faces right; rotate the sprite for other directions) and map markers.
const K = '#2b1d2a';

export function makeRoverArt(scene: Phaser.Scene) {
  pixelTexture(
    scene,
    'rover-top',
    [
      '................',
      '..TT....TT...TT.',
      '..TT....TT...TT.',
      '.KKKKKKKKKKKKKK.',
      '.KWWWWWWWWWWWWK.',
      '.KWSSSSSSWWMMWK.',
      '.KWSSSSSSWWMCWK.',
      '.KWSSSSSSWWMMWK.',
      '.KWWWWWWWWWWWWK.',
      '.KKKKKKKKKKKKKK.',
      '..TT....TT...TT.',
      '..TT....TT...TT.',
    ],
    { K, T: '#3a3a48', W: '#d8dde3', S: '#3d6fb5', M: '#8b94a3', C: '#5ee7ff' },
  );
  pixelTexture(
    scene,
    'dome-top',
    [
      '................',
      '.....KKKKKK.....',
      '...KKGGGGGGKK...',
      '..KGGWGGGGGGGK..',
      '.KGGWGGGGGGGGGK.',
      '.KGWGGLLLLGGGGK.',
      'KGGGGLLLLLLGGGGK',
      'KGGGLLLLLLLLGGGK',
      'KGGGLLLLLLLLGGGK',
      'KGGGGLLLLLLGGGGK',
      '.KGGGGGGGGGGGGK.',
      '.KGGGGGGGGGGGGK.',
      '..KMMMMMMMMMMK..',
      '...KKKKKKKKKK...',
    ],
    { K, G: '#bfe3f0', W: '#ffffff', L: '#6aa84f', M: '#8b94a3' },
  );
  pixelTexture(scene, 'route-dot', ['.KK.', 'KYYK', 'KYYK', '.KK.'], { K, Y: '#ffd166' }, 2);
  pixelTexture(scene, 'route-dot-bad', ['.KK.', 'KRRK', 'KRRK', '.KK.'], { K, R: '#ff5a5a' }, 2);
  pixelTexture(scene, 'find-glow', ['..YY..', '.Y..Y.', 'Y....Y', 'Y....Y', '.Y..Y.', '..YY..'], { Y: '#fff3b0' }, 4);
  pixelTexture(
    scene,
    'propeller',
    ['.......K', '......KM', '.....KM.', 'KKKKKKK.', '.MK.....', 'MK......', 'K.......', '........'],
    { K, M: '#b8c4cc' },
  );
}
