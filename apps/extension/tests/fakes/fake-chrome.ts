/**
 * A minimal in-memory stand-in for the `chrome` global, just enough surface for
 * background/service-worker.ts to run under vitest with no real browser. Registers listeners the
 * same way the real API does and exposes `emit*` helpers plus recorded calls for assertions.
 */

type Listener<Args extends unknown[]> = (...args: Args) => unknown;

export interface FakeChrome {
  chrome: typeof chrome;
  emitTabRemoved: (tabId: number) => void;
  emitTabUpdated: (tabId: number, changeInfo: { url?: string }) => void;
  emitMessage: (message: unknown, sender?: Partial<chrome.runtime.MessageSender>) => Promise<unknown>;
  sentMessages: unknown[];
  tabsSent: Array<{ tabId: number; message: unknown }>;
  createdTabs: Array<{ url: string }>;
  offscreen: { created: boolean; closeCalls: number };
  getSession: () => Record<string, unknown>;
}

async function flushAsync(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

export function createFakeChrome(): FakeChrome {
  const messageListeners: Array<
    (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean | void
  > = [];
  const tabRemovedListeners: Array<Listener<[number]>> = [];
  const tabUpdatedListeners: Array<Listener<[number, { url?: string }]>> = [];

  const sentMessages: unknown[] = [];
  const tabsSent: Array<{ tabId: number; message: unknown }> = [];
  const createdTabs: Array<{ url: string }> = [];
  let sessionStore: Record<string, unknown> = {};
  let syncStore: Record<string, unknown> = {};
  const offscreenState = { created: false, closeCalls: 0 };

  const fakeChromeObject = {
    runtime: {
      onMessage: {
        addListener: (fn: (typeof messageListeners)[number]) => {
          messageListeners.push(fn);
        },
      },
      onInstalled: {
        addListener: () => {
          // Not exercised by these tests — resetState() on install is trivial and not asserted.
        },
      },
      sendMessage: (message: unknown) => {
        sentMessages.push(message);
        return Promise.resolve(undefined);
      },
      getContexts: async () =>
        offscreenState.created ? [{ contextType: "OFFSCREEN_DOCUMENT" }] : [],
      ContextType: { OFFSCREEN_DOCUMENT: "OFFSCREEN_DOCUMENT" },
      lastError: undefined as { message: string } | undefined,
    },
    storage: {
      session: {
        get: async (key: string) => ({ [key]: sessionStore[key] }),
        set: async (items: Record<string, unknown>) => {
          sessionStore = { ...sessionStore, ...items };
        },
      },
      // Settings live in chrome.storage.sync in the real extension; background reads them via
      // loadSettings() on every start/retry, so the fake needs this even though these tests
      // never change settings themselves.
      sync: {
        get: async (key: string) => ({ [key]: syncStore[key] }),
        set: async (items: Record<string, unknown>) => {
          syncStore = { ...syncStore, ...items };
        },
      },
    },
    tabs: {
      onRemoved: {
        addListener: (fn: Listener<[number]>) => {
          tabRemovedListeners.push(fn);
        },
      },
      onUpdated: {
        addListener: (fn: Listener<[number, { url?: string }]>) => {
          tabUpdatedListeners.push(fn);
        },
      },
      sendMessage: (tabId: number, message: unknown) => {
        tabsSent.push({ tabId, message });
        return Promise.resolve(undefined);
      },
      create: (opts: { url: string }) => {
        createdTabs.push(opts);
        return Promise.resolve({});
      },
    },
    tabCapture: {
      getMediaStreamId: (
        _options: { targetTabId: number },
        callback: (streamId: string) => void
      ) => {
        callback("fake-stream-id");
      },
    },
    offscreen: {
      createDocument: async () => {
        offscreenState.created = true;
      },
      closeDocument: async () => {
        offscreenState.created = false;
        offscreenState.closeCalls += 1;
      },
      Reason: { USER_MEDIA: "USER_MEDIA" },
    },
  };

  return {
    chrome: fakeChromeObject as unknown as typeof chrome,
    emitTabRemoved: (tabId) => tabRemovedListeners.forEach((fn) => fn(tabId)),
    emitTabUpdated: (tabId, changeInfo) => tabUpdatedListeners.forEach((fn) => fn(tabId, changeInfo)),
    emitMessage: async (message, sender = {}) => {
      let response: unknown;
      for (const fn of messageListeners) {
        fn(message, sender, (r: unknown) => {
          response = r;
        });
      }
      await flushAsync();
      return response;
    },
    sentMessages,
    tabsSent,
    createdTabs,
    offscreen: offscreenState,
    getSession: () => sessionStore,
  };
}
