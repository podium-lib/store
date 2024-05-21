import { test } from 'node:test';
import assert from 'node:assert';
import { JSDOM } from 'jsdom';

const html = /* html */ `<!doctype html>
<html>
    <head>
        <meta charset="utf-8">
    </head>
    <body></body>
</html>`;
const dom = new JSDOM(html);
globalThis.window = dom.window;

const { MessageBus } = await import('@podium/browser');
const { $authentication, atom, map, deepMap } = await import('../src/store.js');

test('$authentication initial state', () => {
    assert.deepStrictEqual($authentication.value, { token: null });
});

test('atom returns a value connected to the Podium MessageBus', () => {
    const $reminders = atom('reminders', 'list', []);
    assert.deepStrictEqual($reminders.value, []);

    const bus = new MessageBus();
    bus.publish('reminders', 'list', [{ title: 'Buy milk' }]);

    assert.deepStrictEqual($reminders.value, [{ title: 'Buy milk' }]);
});

test('map returns a MapStore connected to the Podium MessageBus', () => {
    const $foo = map('foo', 'bar', { message: 'foo' });
    assert.deepStrictEqual($foo.value, { message: 'foo' });

    // Simulate a message coming in on the MessageBus from some other place
    const bus = new MessageBus();
    bus.publish('foo', 'bar', { message: 'bar' });

    assert.deepStrictEqual($foo.value, { message: 'bar', source: 'bus' });
});

test('deepMap returns a DeepMapStore connected to the Podium MessageBus', () => {
    const initialValue = {
        hobbies: [
            {
                name: 'woodworking',
                friends: [{ id: 123, name: 'Ron Swanson' }],
            },
        ],
        skills: [['Carpentry', 'Sanding'], ['Varnishing']],
    };

    const $profile = deepMap('user', 'profile', initialValue);
    assert.deepStrictEqual($profile.value, initialValue);

    // Simulate a message coming in on the MessageBus from some other place
    const bus = new MessageBus();
    bus.publish('user', 'profile', {
        hobbies: [
            {
                name: 'woodworking',
                friends: [{ id: 123, name: 'Swanson, Ron' }],
            },
        ],
        skills: [['Carpentry', 'Sanding'], ['Varnishing']],
    });

    assert.deepStrictEqual($profile.value, {
        hobbies: [
            {
                name: 'woodworking',
                friends: [{ id: 123, name: 'Swanson, Ron' }],
            },
        ],
        skills: [['Carpentry', 'Sanding'], ['Varnishing']],
        source: 'bus',
    });
});

test('initialValue is ignored if a value exists on the message bus', () => {
    const bus = new MessageBus();

    bus.publish('atom', 'exists', 'Existing value');
    const $atom = atom('atom', 'exists', 'I will not be used');
    assert.equal($atom.value, 'Existing value');

    bus.publish('map', 'exists', { title: 'Existing value' });
    const $map = map('map', 'exists', { title: 'I will not be used' });
    assert.deepStrictEqual($map.value, { title: 'Existing value' });

    bus.publish('deepMap', 'exists', { user: { displayName: 'foobar' } });
    const $deepMap = deepMap('deepMap', 'exists', {
        user: { displayName: 'barfoo' },
    });
    assert.deepStrictEqual($deepMap.value, { user: { displayName: 'foobar' } });
});
