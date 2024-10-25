import { MessageBus } from '@podium/browser';
import {
    atom as nsAtom,
    map as nsMap,
    deepMap as nsDeepMap,
    listenKeys,
} from 'nanostores';

/**
 * @template T
 * @typedef {import("nanostores").Atom<T>} Atom
 */
/**
 * @template T
 * @typedef {import("nanostores").WritableAtom<T>} WritableAtom
 */
/**
 * @template T
 * @typedef {import("nanostores").ReadableAtom<T>} ReadableAtom
 */
/**
 * @template {Record<string, unknown>} T
 * @typedef {import("nanostores").MapStore<T>} MapStore
 */
/**
 * @typedef {import("nanostores").BaseDeepMap} BaseDeepMap
 */
/**
 * @template {import('nanostores').BaseDeepMap} T
 * @typedef {import("nanostores").DeepMapStore<T>} DeepMapStore
 */

export { listenKeys };

// The messageBus reads from a global in-memory storage.
// It can have available messages immediately after being constructed.
const messageBus = new MessageBus();

/**
 * @typedef {object} StoreValue
 * @property {'bus'} [source] Used internally to distinguish between writes from the MessageBus and writes from your app.
 */

/**
 * Internal helper to look for an existing value on the message bus which should take precedence
 * over the given initial value.
 *
 * @template [T=any]
 * @param {string} channel
 * @param {string} topic
 * @param {T} initialValue This value is ignored if an initial value is found on the MessageBus.
 * @returns {T}
 */
function getInitialValue(channel, topic, initialValue) {
    /** @type {import('@podium/browser').Event<T>} */
    const initialFromBus = messageBus.peek(channel, topic);
    if (!initialFromBus) {
        // publish the initial value on the bus so others can get this initialValue
        messageBus.publish(channel, topic, initialValue);
    }
    const initial = initialFromBus?.payload || initialValue;
    return initial;
}

/**
 * Create a nanostores atom that syncs between parts of a Podium application using Podium's MessageBus.
 *
 * @template [T=any]
 * @param {string} channel
 * @param {string} topic
 * @param {T} initialValue This value is ignored if an initial value is found on the MessageBus.
 *
 * @example Unread messages counter
 * ```js
 * import { atom } from "@podium/store";
 *
 * export const $unread = atom("messages", "unread", 0);
 * ```
 */
export function atom(channel, topic, initialValue) {
    const initial = getInitialValue(channel, topic, initialValue);

    /** @type {WritableAtom<T> & Atom<T>} */
    const $store = nsAtom(initial);

    /** @type {import('@podium/browser').MessageHandler<T>} */
    const listener = (event) => {
        $store.set(event.payload);
    };
    messageBus.subscribe(channel, topic, listener);

    $store.listen((value) => {
        // Don't publish if there's already an identical message on the bus
        const lastValue = messageBus.peek(channel, topic);
        if (value === lastValue) {
            return;
        }
        messageBus.publish(channel, topic, value);
    });

    return $store;
}

/**
 * Create a nanostores map that syncs between parts of a Podium application using Podium's MessageBus.
 *
 * A map does not support reactivity on nested objects. For that, see {@link deepMap}.
 *
 * @template {Record<string, unknown>} [T=any]
 * @param {string} channel
 * @param {string} topic
 * @param {T} initialValue This value is ignored if an initial value is found on the MessageBus.
 */
export function map(channel, topic, initialValue) {
    const initial = getInitialValue(channel, topic, initialValue);

    /** @type {MapStore<T & StoreValue>} */
    const $store = nsMap(initial);

    let source = 'app';
    /** @type {import('@podium/browser').MessageHandler<T>} */
    const listener = (event) => {
        source = 'bus';
        $store.set({ ...event.payload });
    };
    messageBus.subscribe(channel, topic, listener);

    $store.listen((value) => {
        // To avoid an infinite loop we fire this only when the source of the change is the app, not the message bus.
        if (source !== 'bus') {
            messageBus.publish(channel, topic, value);
        }
    });

    return $store;
}

/**
 * Create a nanostores deepMap that syncs between parts of a Podium application using Podium's MessageBus.
 * The API for {@link map} is simpler if you have an object that's only one level deep.
 *
 * @template {BaseDeepMap} [T={ [x: string]: unknown; }]
 * @param {string} channel
 * @param {string} topic
 * @param {T} initialValue This value is ignored if an initial value is found on the MessageBus.
 *
 * @example
 * ```js
 * import { deepMap, listenKeys } from "@podium/store";
 *
 * export const $profile = deepMap({
 *   hobbies: [{
 *     name: 'woodworking',
 *     friends: [{ id: 123, name: 'Ron Swanson' }],
 *   }],
 *   skills: [
 *     ['Carpentry', 'Sanding'],
 *     ['Varnishing'],
 *   ],
 * });
 *
 * listenKeys($profile, ['hobbies[0].friends[0].name', 'skills[0][0]']);
 * ```
 */
export function deepMap(channel, topic, initialValue) {
    const initial = getInitialValue(channel, topic, initialValue);

    /** @type {DeepMapStore<T>} */
    // @ts-expect-error https://github.com/microsoft/TypeScript/issues/34933
    const $store = nsDeepMap(initial);

    let source = 'app';
    /** @type {import('@podium/browser').MessageHandler<T>} */
    const listener = (event) => {
        source = 'bus';
        $store.set({ ...event.payload });
    };
    messageBus.subscribe(channel, topic, listener);

    $store.listen((value) => {
        // To avoid an infinite loop we fire this only when the source of the change is the app, not the message bus.
        if (source !== 'bus') {
            messageBus.publish(channel, topic, value);
        }
    });

    return $store;
}
