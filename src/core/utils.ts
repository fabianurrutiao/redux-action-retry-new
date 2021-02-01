import {
  lensProp,
} from 'ramda';

interface ObjWithPhrase {
  cache: string;
}

export const cacheLens = lensProp('cache')
// fixed
// export const cacheLens = lensProp<ObjWithPhrase>('cache');