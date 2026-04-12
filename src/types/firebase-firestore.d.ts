// Workaround: firebase 10.14.1 exports map for "firebase/firestore" points to a
// non-existent .d.ts file.  Re-export the underlying @firebase/firestore types.
declare module 'firebase/firestore' {
  export * from '@firebase/firestore';
}
