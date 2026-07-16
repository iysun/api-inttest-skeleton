/** 场景 Tab 条：横排展示已打开的场景实例，运行中显示 spinner + 实时耗时；
    点击切换（emit activate）、× 关闭（emit close）。多 Tab 溢出横向滚动。
    纯展示组件，Tab 数据与激活态由父级持有；样式复用 index.html 的 .tab-strip/.tab-item 全局类。 */
export default {
  props: {
    tabs: { type: Array, default: () => [] }, // [{ id, file, base, running, timer:{ elapsedText } }]
    activeId: { default: null },               // 当前激活的 tab.id
  },
  emits: ['activate', 'close'],
  template: `
    <div v-if="tabs.length" class="tab-strip">
      <div v-for="t in tabs" :key="t.id" class="tab-item" :class="{ active: t.id === activeId }"
        :title="t.file" @click="$emit('activate', t.id)">
        <span v-if="t.running" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        <span class="tab-label text-truncate">{{ t.base }}</span>
        <span v-if="t.running" class="tab-elapsed">{{ t.timer.elapsedText }}</span>
        <button type="button" class="tab-close" title="关闭" @click.stop="$emit('close', t.id)">×</button>
      </div>
    </div>
  `,
};
