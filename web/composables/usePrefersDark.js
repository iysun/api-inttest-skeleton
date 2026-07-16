const { ref, onMounted, onUnmounted } = Vue;

/** 跟踪系统深色偏好：prefersDark 为响应式布尔，随 prefers-color-scheme 变化更新；
    可选 onChange(matches) 在系统切换时回调（如 auto 档主题重算）。
    onUnmounted 退订，补上手写 matchMedia 常漏的清理。 */
export function usePrefersDark(onChange) {
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const prefersDark = ref(mql.matches);

  function handler(e) {
    prefersDark.value = e.matches;
    if (onChange) onChange(e.matches);
  }

  onMounted(() => mql.addEventListener('change', handler));
  onUnmounted(() => mql.removeEventListener('change', handler));

  return { prefersDark };
}
