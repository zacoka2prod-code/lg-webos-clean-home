export const REMOTE_KEY = {
  LEFT: 37,
  UP: 38,
  RIGHT: 39,
  DOWN: 40,
  ENTER: 13,
  BACK: 461,
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
  VOLUME_UP: 447,
  VOLUME_DOWN: 448,
  VOLUME_MUTE: 449,
  CHANNEL_UP: 427,
  CHANNEL_DOWN: 428
};

// Number keys on the remote or a physical keyboard. The digit row reports
// 1-9 as 49-57 and 0 as 48; the numeric keypad reports 0-9 as 96-105. event.key
// covers layouts that report neither code. -1 means "not a number key".
const DIGIT_FROM_CODE = {
  48: 0, 49: 1, 50: 2, 51: 3, 52: 4, 53: 5, 54: 6, 55: 7, 56: 8, 57: 9,
  96: 0, 97: 1, 98: 2, 99: 3, 100: 4, 101: 5, 102: 6, 103: 7, 104: 8, 105: 9
};

/**
 * The digit a number key types: 0-9, or -1 when it is not a number key.
 * @param {number} code the event's keyCode
 * @param {string} [key] the event's key, when it is a single "0"-"9" character
 */
export function digitFromKey(code, key) {
  if (typeof key === 'string' && key.length === 1 && key >= '0' && key <= '9') {
    return key.charCodeAt(0) - 48;
  }
  const digit = DIGIT_FROM_CODE[code];
  return typeof digit === 'number' ? digit : -1;
}

export const HOME_APP_IDS = [
  'com.webos.app.home',
  'com.webos.app.launcher',
  'com.webos.app.homeupdater',
  'com.webos.app.dashboard',
  'com.palm.app.home',
  'com.webos.app.homelauncher',
  'com.webos.app.gamehome',
  'com.webos.app.seniorhome'
];

export function isHomeApp(appId) {
  if (!appId) return false;
  return HOME_APP_IDS.indexOf(appId) >= 0;
}