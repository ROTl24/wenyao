function stoppedError() {
  const error = new Error('已停止接收，本次解读未完成。');
  error.publicCode = 'AI_GENERATION_STOPPED';
  error.publicNextAction = '服务商可能仍在处理或计费；问爻不会自动重发请求。';
  return error;
}

/** Owner-scoped request lifetime. A late response can never undo an accepted stop. */
function createGenerationRequests() {
  const owners = new Map();
  return {
    async run(owner, requestId, action) {
      const id = requestId || Symbol('generation');
      if (requestId && (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(requestId))) throw new TypeError('生成请求标识无效');
      const requests = owners.get(owner) || new Map();
      if (requests.has(id)) throw new Error('这次生成请求已经在进行中。');
      owners.set(owner, requests);
      const controller = new AbortController();
      requests.set(id, controller);
      try {
        const result = await action(controller.signal);
        if (controller.signal.aborted) throw stoppedError();
        return result;
      } catch (error) {
        if (controller.signal.aborted) throw stoppedError();
        throw error;
      } finally {
        requests.delete(id);
        if (!requests.size) owners.delete(owner);
      }
    },
    cancel(owner, requestId) {
      const controller = owners.get(owner)?.get(requestId);
      if (!controller) return false;
      controller.abort(stoppedError());
      return true;
    },
    cancelOwner(owner) {
      for (const controller of owners.get(owner)?.values() || []) controller.abort(stoppedError());
    },
  };
}

module.exports = { createGenerationRequests, stoppedError };
