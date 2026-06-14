/**
 * Global teardown: flush any open handles, print summary note.
 */
async function globalTeardown(): Promise<void> {
  console.log("[global-teardown] Platform NFR test suite complete.");
}

export default globalTeardown;