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
const { atom, map, deepMap } = await import('../src/store.js');

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

    assert.deepStrictEqual($foo.value, { message: 'bar' });
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

test('does not publish a message on the bus if the bus listener was what wrote to the store', () => {
    const bus = new MessageBus();

    const $atom = atom('atom', 'test', 'Value');
    const $map = map('map', 'test', { title: 'Value' });
    const $deepMap = deepMap('deepMap', 'test', {
        user: { displayName: 'barfoo' },
    });

    const atomSub = test.mock.fn();
    bus.subscribe('atom', 'test', atomSub);

    const mapSub = test.mock.fn();
    bus.subscribe('map', 'test', mapSub);

    const deepMapSub = test.mock.fn();
    bus.subscribe('deepMap', 'test', deepMapSub);

    bus.publish('atom', 'test', 'Value');
    assert.equal($atom.value, 'Value');
    assert.equal(
        atomSub.mock.callCount(),
        1,
        'Expected the atom to not republish the same value to the MessageBus',
    );

    bus.publish('map', 'test', { title: 'Value' });
    assert.deepStrictEqual($map.value, { title: 'Value' });
    assert.equal(
        mapSub.mock.callCount(),
        1,
        'Expected the map to not republish the same value to the MessageBus',
    );

    bus.publish('deepMap', 'test', {
        user: { displayName: 'barfoo' },
    });
    assert.deepStrictEqual($deepMap.value, {
        user: { displayName: 'barfoo' },
    });
    assert.equal(
        deepMapSub.mock.callCount(),
        1,
        'Expected the deepMap to not republish the same value to the MessageBus',
    );
});
