const { onMounted, onUnmounted } = Vue;

/** 点击元素外部时回调：在 document 上挂 click 监听（默认捕获相位，先于内部 stopPropagation 生效），
    组件卸载自动移除。elRef 传模板 ref（.value 为真实 DOM）。
    用法：const root = ref(null); useClickOutside(root, close); 模板 ref="root"。 */
export function useClickOutside(elRef, handler, { capture = true } = {}) {
  function onDocClick(e) {
    const el = elRef && elRef.value;
    if (el && !el.contains(e.target)) handler(e);
  }
  onMounted(() => document.addEventListener('click', onDocClick, capture));
  onUnmounted(() => document.removeEventListener('click', onDocClick, capture));
}
