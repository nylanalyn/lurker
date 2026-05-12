import { defineStore } from 'pinia';

// Per-network state for the /LIST channel browser. Each entry is one network's
// streaming chanlist session: results land in batches as the server forwards
// RPL_LIST rows, and `loading` flips off when RPL_LISTEND arrives. We keep
// the last completed result around so reopening the modal doesn't blank out
// what the user already saw — they can refetch explicitly.
export const useChanlistStore = defineStore('chanlist', {
  state: () => ({
    byNetwork: {},
  }),
  getters: {
    forNetwork: (state) => (networkId) => state.byNetwork[networkId] || null,
  },
  actions: {
    ensure(networkId) {
      if (!this.byNetwork[networkId]) {
        this.byNetwork[networkId] = {
          loading: false,
          channels: [],
          // Generation id so an in-flight batch can't bleed into a fresh
          // /LIST run the user kicked off before the previous one ended.
          generation: 0,
          lastUpdated: null,
        };
      }
      return this.byNetwork[networkId];
    },
    start(networkId) {
      const s = this.ensure(networkId);
      s.loading = true;
      s.channels = [];
      s.generation += 1;
      s.lastUpdated = null;
    },
    addBatch(networkId, channels) {
      const s = this.ensure(networkId);
      s.channels.push(...channels);
    },
    end(networkId) {
      const s = this.ensure(networkId);
      s.loading = false;
      s.lastUpdated = new Date().toISOString();
    },
    reset(networkId) {
      delete this.byNetwork[networkId];
    },
  },
});
