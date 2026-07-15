import { CHECK_ICON } from './icons.js';

/** Ant-Design 风格单选下拉：替代原生 select，得到可定制的圆角浮层/悬浮态/选中态。
    用法 <ant-select v-model="x" :options="[{value,label}]">。支持键盘（↑↓ 移动、Enter 选中、Esc 关闭）、
    点击外部关闭。仅单选，够本控制台主题切换用。 */
export default {
  props: {
    modelValue: { default: '' },
    options: { type: Array, default: () => [] }, // [{ value, label }]
    placeholder: { type: String, default: '请选择' },
  },
  emits: ['update:modelValue'],
  data() { return { open: false, activeValue: this.modelValue }; },
  computed: {
    currentLabel() {
      const o = this.options.find((x) => x.value === this.modelValue);
      return o ? o.label : this.placeholder;
    },
  },
  methods: {
    toggle() { this.open ? this.close() : this.openList(); },
    openList() { this.open = true; this.activeValue = this.modelValue; },
    close() { this.open = false; },
    choose(v) { this.$emit('update:modelValue', v); this.close(); },
    onKey(e) {
      const keys = ['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape'];
      if (!keys.includes(e.key)) return;
      e.preventDefault();
      if (e.key === 'Escape') return this.close();
      if (!this.open) { if (e.key !== 'Escape') this.openList(); return; }
      if (e.key === 'Enter' || e.key === ' ') return this.choose(this.activeValue);
      const vals = this.options.map((o) => o.value);
      let i = vals.indexOf(this.activeValue);
      i = e.key === 'ArrowDown' ? Math.min(vals.length - 1, i + 1) : Math.max(0, i - 1);
      this.activeValue = vals[i];
    },
    onDocClick(e) { if (this.open && this.$refs.root && !this.$refs.root.contains(e.target)) this.close(); },
  },
  watch: { modelValue(v) { this.activeValue = v; } },
  mounted() { document.addEventListener('click', this.onDocClick, true); },
  unmounted() { document.removeEventListener('click', this.onDocClick, true); },
  template: `
    <div class="ant-select" :class="{ 'ant-select-open': open }" ref="root">
      <div class="ant-select-selector" tabindex="0" role="combobox" :aria-expanded="open"
        @click="toggle" @keydown="onKey">
        <span class="ant-select-selection-item">{{ currentLabel }}</span>
        <span class="ant-select-arrow">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round"><path d="m3 6 5 5 5-5"/></svg>
        </span>
      </div>
      <transition name="ant-slide">
        <div v-if="open" class="ant-select-dropdown" role="listbox">
          <div v-for="o in options" :key="o.value" class="ant-select-item"
            :class="{ 'ant-select-item-selected': o.value === modelValue, 'ant-select-item-active': o.value === activeValue }"
            role="option" :aria-selected="o.value === modelValue"
            @click="choose(o.value)" @mouseenter="activeValue = o.value">
            <span class="ant-select-item-content">{{ o.label }}</span>
            <span v-if="o.value === modelValue" class="ant-select-item-check">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">${CHECK_ICON}</svg>
            </span>
          </div>
        </div>
      </transition>
    </div>
  `,
};
