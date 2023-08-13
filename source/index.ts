// /source/index.ts
// Export away!

// Export all the types as named exports
export * from './types.js'

// Export the slowDown function as a named export only.
export { default as slowDown } from './lib.js'
