const { ref } = Vue;

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

/** 剪贴板复制 + 短暂「已复制」态：copy(text, key) 复制成功后把 copied 置为 key，resetMs 后自动清空。
    key 用于同一组件里区分多个复制按钮（如 'code' / 'curl'）。返回 { copied, copy }。 */
export function useClipboard({ resetMs = 1200 } = {}) {
  const copied = ref('');
  async function copy(text, key = 'default') {
    const ok = await copyText(text);
    if (!ok) return false;
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = ''; }, resetMs);
    return true;
  }
  return { copied, copy };
}
