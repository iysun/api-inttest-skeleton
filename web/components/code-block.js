import { CHECK_ICON } from './icons.js';

/** 复制文本到剪贴板：优先 Clipboard API（127.0.0.1 为安全上下文），失败回退 execCommand */
async function copyText(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) { /* 落到 execCommand 回退 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (e) {
    return false;
  }
}

/** 代码块 + 右上角复制动作：复制原文；curl 非空时多一个「复制为 curl」按钮 */
export default {
  props: {
    code: { type: String, default: '' },
    lang: { type: String, default: 'yaml' },
    curl: { type: String, default: '' },
    curlFn: { type: Function, default: null },
  },
  data() { return { copied: '' }; },
  computed: {
    hasCurl() { return !!this.curl || !!this.curlFn; },
  },
  methods: {
    async doCopy(which) {
      let text;
      if (which === 'curl') {
        try { text = this.curlFn ? await this.curlFn() : this.curl; }
        catch (e) { window.alert('生成 curl 失败：' + ((e && e.message) || e)); return; }
      } else {
        text = this.code;
      }
      const ok = await copyText(text);
      if (!ok) return;
      this.copied = which;
      setTimeout(() => { if (this.copied === which) this.copied = ''; }, 1200);
    },
  },
  template: `
    <div class="code-wrap">
      <div class="code-actions">
        <button type="button" class="code-copy-btn" :title="copied === 'code' ? '已复制' : '复制'" @click="doCopy('code')">
          <svg v-if="copied === 'code'" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2">${CHECK_ICON}</svg>
          <svg v-else viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="5.3" y="5.3" width="8.2" height="8.2" rx="1.3"/><path d="M10.7 5.3V4a1 1 0 0 0-1-1H3a1 1 0 0 0-1 1v6.7a1 1 0 0 0 1 1h1.3"/></svg>
        </button>
        <button v-if="hasCurl" type="button" class="code-copy-btn" :title="copied === 'curl' ? '已复制' : '复制为 curl'" @click="doCopy('curl')">{{ copied === 'curl' ? '已复制' : 'curl' }}</button>
      </div>
      <pre class="yaml"><code v-highlight="{ code, lang }"></code></pre>
    </div>
  `,
};
