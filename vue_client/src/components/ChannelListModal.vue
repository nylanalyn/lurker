<template>
  <div class="modal" @click.self="$emit('close')" @keydown.esc="$emit('close')">
    <div class="card" tabindex="-1" ref="cardEl">
      <header class="head">
        <h2>channels — {{ networkLabel }}</h2>
        <button class="link" @click="$emit('close')" title="close"><i class="fa-solid fa-xmark"></i></button>
      </header>
      <div class="controls">
        <input
          ref="filterEl"
          v-model="filter"
          class="filter"
          type="text"
          placeholder="filter (name or topic)"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn" :disabled="!canRefresh" @click="refresh">
          {{ state.loading ? 'Listing…' : 'Refresh' }}
        </button>
        <span class="meta">{{ stateLabel }}</span>
      </div>
      <div class="list-wrap">
        <table v-if="filtered.length" class="list">
          <thead>
            <tr>
              <th class="col-name">
                <button class="sort" @click="setSort('name')">
                  name<span v-if="sortKey === 'name'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
                </button>
              </th>
              <th class="col-users">
                <button class="sort" @click="setSort('users')">
                  users<span v-if="sortKey === 'users'">{{ sortDir === 'asc' ? ' ▲' : ' ▼' }}</span>
                </button>
              </th>
              <th class="col-topic">topic</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="ch in filtered"
              :key="ch.channel"
              class="row"
              @click="onJoin(ch)"
              :title="`Join ${ch.channel}`"
            >
              <td class="col-name">{{ ch.channel }}</td>
              <td class="col-users">{{ ch.num_users }}</td>
              <td class="col-topic">{{ ch.topic }}</td>
            </tr>
          </tbody>
        </table>
        <p v-else-if="state.loading" class="empty">Loading channels…</p>
        <p v-else-if="!state.channels.length" class="empty">No channels yet — try Refresh.</p>
        <p v-else class="empty">No matches.</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue';
import { useChanlistStore } from '../stores/chanlist.js';
import { useNetworksStore } from '../stores/networks.js';
import { useBuffersStore } from '../stores/buffers.js';
import { socketSend } from '../composables/useSocket.js';

const props = defineProps({
  networkId: { type: Number, required: true },
});
const emit = defineEmits(['close']);

const chanlist = useChanlistStore();
const networks = useNetworksStore();
const buffers = useBuffersStore();

const cardEl = ref(null);
const filterEl = ref(null);
const filter = ref('');
const sortKey = ref('users');
const sortDir = ref('desc');

const state = computed(() => chanlist.forNetwork(props.networkId) || { loading: false, channels: [], lastUpdated: null });
const canRefresh = computed(() => !state.value.loading);

const networkLabel = computed(() => {
  const net = networks.networks.find((n) => n.id === props.networkId);
  return net?.name || `net:${props.networkId}`;
});

const stateLabel = computed(() => {
  const s = state.value;
  if (s.loading) return `streaming… ${s.channels.length}`;
  if (s.lastUpdated) return `${s.channels.length} total`;
  return '';
});

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const list = state.value.channels;
  const matched = q
    ? list.filter((ch) =>
        ch.channel.toLowerCase().includes(q)
        || (ch.topic || '').toLowerCase().includes(q))
    : list.slice();
  const sign = sortDir.value === 'asc' ? 1 : -1;
  matched.sort((a, b) => {
    if (sortKey.value === 'users') {
      return ((a.num_users || 0) - (b.num_users || 0)) * sign;
    }
    return a.channel.localeCompare(b.channel) * sign;
  });
  return matched;
});

function setSort(key) {
  if (sortKey.value === key) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
  } else {
    sortKey.value = key;
    sortDir.value = key === 'users' ? 'desc' : 'asc';
  }
}

function refresh() {
  socketSend({ type: 'list-channels', networkId: props.networkId });
}

function onJoin(ch) {
  socketSend({ type: 'join', networkId: props.networkId, channel: ch.channel });
  buffers.activate(props.networkId, ch.channel);
  emit('close');
}

onMounted(() => {
  cardEl.value?.focus();
  // Auto-kick a /LIST on open if we've never run one for this network. The
  // user explicitly opened the modal — silence and a Refresh button would
  // feel broken.
  if (!state.value.lastUpdated && !state.value.loading) refresh();
  // Move focus to the filter after the auto-load fires so typing is immediate.
  setTimeout(() => filterEl.value?.focus(), 0);
});
</script>

<style scoped>
.modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.card {
  background: var(--bg);
  border: 1px solid var(--accent);
  width: min(900px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  outline: none;
}
.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
}
.head h2 {
  margin: 0;
  flex: 1;
  color: var(--accent);
  font-weight: 600;
  text-transform: lowercase;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.link {
  background: none;
  border: none;
  color: var(--fg-muted);
  cursor: pointer;
  font: inherit;
  padding: 0 4px;
}
.link:hover { color: var(--fg); }

.controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
}
.filter {
  flex: 1;
  min-width: 0;
  background: var(--bg);
  color: var(--fg);
  border: 1px solid var(--border);
  padding: 4px 8px;
  font: inherit;
}
.filter:focus { outline: none; border-color: var(--accent); }
.btn {
  background: transparent;
  border: 1px solid var(--border);
  color: var(--fg);
  font: inherit;
  padding: 4px 10px;
  cursor: pointer;
}
.btn:hover:not(:disabled) { border-color: var(--accent); background: var(--bg-soft); }
.btn:disabled { opacity: 0.5; cursor: default; }
.meta { color: var(--fg-muted); font-size: 0.9em; }

.list-wrap {
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}
.list {
  width: 100%;
  border-collapse: collapse;
}
.list th, .list td {
  text-align: left;
  padding: 4px 16px;
  border-bottom: 1px solid var(--border);
  vertical-align: top;
}
.list thead th {
  position: sticky;
  top: 0;
  background: var(--bg);
  z-index: 1;
  color: var(--fg-muted);
  font-weight: 500;
}
.sort {
  background: none;
  border: none;
  color: inherit;
  font: inherit;
  padding: 0;
  cursor: pointer;
}
.sort:hover { color: var(--fg); }
.col-users { width: 80px; text-align: right; }
.col-name  { width: 200px; color: var(--accent); white-space: nowrap; }
.col-topic { color: var(--fg-muted); }
.row { cursor: pointer; }
.row:hover { background: var(--bg-soft); }
.row:hover .col-topic { color: var(--fg); }
.empty {
  text-align: center;
  color: var(--fg-muted);
  font-style: italic;
  padding: 32px;
}
</style>
