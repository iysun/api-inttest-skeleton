const { ref, watch } = Vue;

/** localStorage 安全读：不可用/损坏时回退默认值。json=true 时 JSON.parse。 */
export function readStored(key, def, { json = false } = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return def;
    return json ? JSON.parse(raw) : raw;
  } catch (e) {
    return def; // localStorage 不可用或 JSON 损坏 → 回退默认
  }
}

/** localStorage 安全写：不可用时静默失败（仅本次会话生效）。json=true 时 JSON.stringify。 */
export function writeStored(key, val, { json = false } = {}) {
  try {
    localStorage.setItem(key, json ? JSON.stringify(val) : val);
  } catch (e) { /* localStorage 不可用则仅本次生效 */ }
}

/** 与 localStorage 双向同步的 ref：初值取存储值（缺省回退 def），变化即写回，读写均 try/catch。
    适合「单个标量偏好」（如主题）。派生对象的持久化用底层 readStored/writeStored。 */
export function usePersistedRef(key, def, { json = false } = {}) {
  const r = ref(readStored(key, def, { json }));
  watch(r, (v) => writeStored(key, v, { json }), { deep: json });
  return r;
}
