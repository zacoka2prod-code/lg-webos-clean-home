import {afterEach, describe, expect, it} from 'vitest';
import {createBackgroundController} from '../src/js/background.js';
import {AERIAL_BACKGROUNDS} from '../src/js/aerials.js';

let controller = null;

afterEach(() => {
  if (controller && typeof controller.destroy === 'function') controller.destroy();
  controller = null;
  document.body.className = '';
});

function makeElements() {
  return {
    backgroundLayer: document.createElement('div'),
    scrim: document.createElement('div')
  };
}

function aerialConfig(overrides) {
  return {
    profile: 'default',
    launcher: {},
    background: Object.assign({
      source: 'aerial',
      mode: 'static',
      aerial: AERIAL_BACKGROUNDS[0].id,
      shuffle: false
    }, overrides)
  };
}

function mount(config) {
  const elements = makeElements();
  const changes = [];
  elements.onAerialChange = function (change) { changes.push(change); };
  controller = createBackgroundController(elements, function () { return config; });
  return {elements: elements, changes: changes};
}

describe('background controller: aerial channel stepping', () => {
  it('steps the aerial catalog in Single mode, in settings order', async () => {
    const config = aerialConfig({});
    const mounted = mount(config);
    await controller.refresh();

    const next = controller.stepAerial(1);
    expect(next).toEqual({
      id: AERIAL_BACKGROUNDS[1].id,
      title: AERIAL_BACKGROUNDS[1].title,
      mode: 'single'
    });
    expect(mounted.changes).toEqual([next]);

    const back = controller.stepAerial(-1);
    expect(back.id).toBe(AERIAL_BACKGROUNDS[0].id);
  });

  it('wraps Single mode at both ends of the catalog', async () => {
    const config = aerialConfig({});
    mount(config);
    await controller.refresh();

    const first = controller.stepAerial(-1);
    expect(first.id).toBe(AERIAL_BACKGROUNDS[AERIAL_BACKGROUNDS.length - 1].id);

    const wrapped = controller.stepAerial(1);
    expect(wrapped.id).toBe(AERIAL_BACKGROUNDS[0].id);
  });

  it('steps the playing order in Slideshow mode and wraps', async () => {
    const config = aerialConfig({mode: 'slideshow'});
    mount(config);
    await controller.refresh();

    const second = controller.stepAerial(1);
    expect(second.id).toBe(AERIAL_BACKGROUNDS[1].id);
    expect(second.mode).toBe('slideshow');

    const third = controller.stepAerial(1);
    expect(third.id).toBe(AERIAL_BACKGROUNDS[2].id);
  });

  it('wraps Slideshow mode at the start of the order', async () => {
    const config = aerialConfig({mode: 'slideshow'});
    mount(config);
    await controller.refresh();

    const last = controller.stepAerial(-1);
    expect(last.id).toBe(AERIAL_BACKGROUNDS[AERIAL_BACKGROUNDS.length - 1].id);
  });

  it('does nothing when the resolved source is not aerial', async () => {
    const config = aerialConfig({source: 'preset', preset: 'warm-gradient'});
    const mounted = mount(config);
    await controller.refresh();

    expect(controller.stepAerial(1)).toBeNull();
    expect(mounted.changes).toEqual([]);
  });

  it('does nothing when the aerial wallpaper fell back to the gradient', async () => {
    const config = aerialConfig({});
    const mounted = mount(config);
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    Object.defineProperty(window.navigator, 'onLine', {value: false, configurable: true});
    try {
      await controller.refresh();
      expect(controller.stepAerial(1)).toBeNull();
      expect(mounted.changes).toEqual([]);
    } finally {
      if (original) Object.defineProperty(window.navigator, 'onLine', original);
    }
  });
});
