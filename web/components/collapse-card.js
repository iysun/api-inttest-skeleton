/** 折叠卡片：默认 card 样式；inline=true 走步骤内 border-top 小样式（request/response） */
export default {
  props: {
    title: String,
    open: { type: Boolean, default: true },
    inline: { type: Boolean, default: false },
  },
  data() { return { show: this.open }; },
  template: `
    <div v-if="inline" class="border-top">
      <button class="btn btn-link btn-sm text-decoration-none px-3 py-1 d-flex align-items-center gap-2"
        type="button" :aria-expanded="show" @click="show = !show">
        <span class="caret">▾</span>{{ title }}
      </button>
      <div v-show="show"><slot></slot></div>
    </div>
    <div v-else class="card mb-3">
      <div class="card-header p-0 d-flex align-items-center">
        <button class="btn btn-link text-decoration-none flex-grow-1 text-start px-3 py-2 d-flex align-items-center gap-2 min-w-0"
          type="button" :aria-expanded="show" @click="show = !show">
          <span class="caret">▾</span><span class="fw-semibold text-truncate">{{ title }}</span>
        </button>
        <div class="card-head-extra d-flex align-items-center gap-2 pe-2 ps-1"><slot name="head-extra"></slot></div>
      </div>
      <div v-show="show"><slot></slot></div>
    </div>
  `,
};
