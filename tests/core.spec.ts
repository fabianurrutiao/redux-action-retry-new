import * as fc from 'fast-check';
import { last } from 'ramda';
import { wholePipeline } from "./utils/wholePipeline";
import { Actions2RetryAllPattern } from './utils/Actions2RetryAllPattern';
import {
  resetActionCreator,
  retryAllActionCreator,
  removeActionCreator,
  REDUX_ACTION_RETRY,
} from '../src/';

test('Non cacheable actions are not cached', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        type: fc.fullUnicodeString({
          minLength: 1,
          maxLength: 15
        }),
        payload: fc.fullUnicodeString(),
        id: fc.uuid()
      }), {
        minLength: 1,
        maxLength: 15
      }),
      (actions) => {
        // {} empty object as State
        // cache: {} No cache config
        const pipeline = wholePipeline({}, {
          cache: {},
        })
        for (const inputAction of actions) {
          const action = {
            type: inputAction.type,
            payload: inputAction.payload,
            id: inputAction.id,
          }
          pipeline.store.dispatch(action)
          // The cache in the State, should be empty.
          // We did not configure any action to be cached.
          expect(pipeline.store.getState())
            .toEqual({ [REDUX_ACTION_RETRY]: { cache: [] } })
        }
      }
    )
  )
})

test('Cacheable actions are cached', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        type: fc.fullUnicodeString({
          minLength: 1,
          maxLength: 15
        }),
        payload: fc.fullUnicodeString(),
        id: fc.uuid()
      }), {
        minLength: 1,
        maxLength: 15
      }),
      (actions) => {
        const config = {
          cache: actions.reduce(
            (config, action) => ({
              ...config,
              // Important config is key:value 
              // this says whats action would be cached
              [action.type]: {}
            }),
            {}
          )
        }
        const pipeline = wholePipeline({}, config)
        const expectedCachedActions = []
        for (const inputAction of actions) {
          const action = {
            type: inputAction.type,
            payload: inputAction.payload,
            meta: {
              [REDUX_ACTION_RETRY]: {
                // To identify each action add a meta property.
                id: inputAction.id
              }
            }
          }
          const cacheWrap = {
            action
          }
          expectedCachedActions.push(cacheWrap)
          pipeline.store.dispatch(action)
          // while iterating we can expect the dispatched action to be the last element of the cache
          expect(last(pipeline.store.getState()[REDUX_ACTION_RETRY].cache))
            .toEqual(cacheWrap)
        }
        expect(pipeline.store.getState()[REDUX_ACTION_RETRY].cache)
          .toEqual(expectedCachedActions)
      }
    )
  )
})

test('Reset returns empty cache', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        // Now we create the whole action in the start
        type: fc.fullUnicodeString({
          minLength: 1,
          maxLength: 15
        }),
        payload: fc.fullUnicodeString(),
        meta: fc.record({
          [REDUX_ACTION_RETRY]: fc.record({
            id: fc.uuid()
          })
        })
      }), {
        minLength: 1,
        maxLength: 15
      }),
      (actions) => {
        const libConfig = {
          cache: actions.reduce(
            (config, action) => ({
              ...config,
              [action.type]: {}
            }),
            {}
          )
        }
        const pipeline = wholePipeline({}, libConfig)

        // Call reset action to empty cache after each push to cache
        const resetAction = resetActionCreator()
        for (const action of actions) {
          // if we dispatch an Action and then a reset, the store should be empty
          pipeline.store.dispatch(action)
          pipeline.store.dispatch(resetAction)
          expect(pipeline.store.getState()[REDUX_ACTION_RETRY].cache).toEqual([])
        }

        // Call reset action creator should clean all stored cache
        for (const action of actions) {
          pipeline.store.dispatch(action)
        }
        pipeline.store.dispatch(resetAction)
        expect(pipeline.store.getState()[REDUX_ACTION_RETRY].cache).toEqual([])
      }
    )
  )
})

test('Remove returns cache without element', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        type: fc.fullUnicodeString({
          minLength: 1,
          maxLength: 15
        }),
        payload: fc.anything(),
        meta: fc.record({
          [REDUX_ACTION_RETRY]: fc.record({
            id: fc.uuid()
          })
        })
      }), {
        minLength: 1,
        maxLength: 15
      }),
      (actions) => {
        const libConfig = {
          cache: actions.reduce(
            (config, action) => ({
              ...config,
              [action.type]: {}
            }),
            {}
          )
        }
        const pipeline = wholePipeline({}, libConfig)
        for (const action of actions) {
          const wrappedAction = {
            action
          }
          // Create a remove Action using the reference of the target, more accurately, the id of the target Action to be removed.
          const removeAction = removeActionCreator(action)
          // Get a snapshot of the current Store.
          const oldState = pipeline.store.getState();
          // Dispatch the Action.
          pipeline.store.dispatch(action);
          expect(last(pipeline.store.getState()[REDUX_ACTION_RETRY].cache))
            .toEqual(wrappedAction)
          // Dispatch the remove Action.
          pipeline.store.dispatch(removeAction)
          // Assert the new state, as we should have removed the action, should be the same as the previous one before the Action was cached.
          expect(pipeline.store.getState()).toEqual(oldState)
        }
        // And finally, check at the end the cache is empty as we were removing each added Action.
        expect(pipeline.store.getState()[REDUX_ACTION_RETRY].cache)
          .toEqual([])

        // Should return cache with only one action
        const customAction = {
          type: fc.fullUnicodeString({
            minLength: 1,
            maxLength: 15
          }),
          payload: fc.anything(),
          meta: fc.record({
            [REDUX_ACTION_RETRY]: fc.record({
              id: fc.uuid()
            })
          })
        };
        pipeline.store.dispatch(customAction);
        for (const action of actions) {
          const wrappedAction = {
            action
          }
          const removeAction = removeActionCreator(action)
          const oldState = pipeline.store.getState();
          pipeline.store.dispatch(action);
          expect(last(pipeline.store.getState()[REDUX_ACTION_RETRY].cache))
            .toEqual(wrappedAction)
          pipeline.store.dispatch(removeAction)
          expect(pipeline.store.getState()).toEqual(oldState)
        }
        
      }
    )
  )
})

test('Retry all', () => {
  fc.assert(
    fc.property(
      fc.array(
        fc.record({
          type: fc.fullUnicodeString({
            minLength: 1,
            maxLength: 15
          }),
          payload: fc.anything(),
          meta: fc.record({
            [REDUX_ACTION_RETRY]: fc.record({
              id: fc.uuid(),
            })
          })
        })
      ),
      actions => {
        const libConfig = {
          cache: actions.reduce(
            (config, action) => ({
              ...config,
              [action.type]: {}
            }),
            {}
          )
        }
        const pipeline = wholePipeline({}, libConfig)
        for (const action of actions) {
          pipeline.store.dispatch(action)
          expect(last(pipeline.store.getState()[REDUX_ACTION_RETRY].cache))
            .toEqual({ action: action })
          const oldState = pipeline.store.getState();
          pipeline.store.dispatch(retryAllActionCreator())
          // States should be the same, no reorder/new cations
          expect(pipeline.store.getState())
            .toEqual(oldState)
        }
        expect(pipeline.gotToReducerSpy.mock.calls)
          .toEqual(Actions2RetryAllPattern(actions))
        // Check againts pattern
        expect(pipeline.store.getState()[REDUX_ACTION_RETRY].cache)
          .toEqual(actions.map(action => ({ action: action })))
      }
    )
  )
})
