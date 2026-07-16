const { ref } = Vue;

/** 秒表工厂：start() 起表、stop() 停表，elapsedText 实时输出 "x.x s"。
    刻意不绑组件生命周期（不用 onMounted/onUnmounted）——计时器挂在每个 tab 对象上，
    后台 tab 面板已卸载仍要继续走表，故由调用方（run/closeTab）显式 start/stop。
    多 tab 各建一个实例，互不共享状态。 */
export function createElapsedTimer() {
  const elapsedText = ref('0.0s');
  let t0 = 0;
  let timerId = null;

  function tick() { elapsedText.value = ((performance.now() - t0) / 1000).toFixed(1) + 's'; }

  function start() {
    stop(); // 幂等：重复 start 不叠计时器
    t0 = performance.now();
    elapsedText.value = '0.0s';
    timerId = setInterval(tick, 100);
  }

  function stop() {
    if (timerId != null) { clearInterval(timerId); timerId = null; }
  }

  return { elapsedText, start, stop };
}
