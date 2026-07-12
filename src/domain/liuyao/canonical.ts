const ROOT_PATH = '$';
const SHA256_HEX = /^[0-9a-f]{64}$/u;

export interface HashPort {
  readonly sha256: (value: string) => string;
}

function canonicalError(path: string, reason: string): never {
  throw new TypeError(`strict canonical JSON 在 ${path} ${reason}`);
}

function quoted(value: string): string {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new TypeError('strict canonical JSON 无法序列化字符串');
  }
  return serialized;
}

function childPath(path: string, key: string): string {
  return `${path}[${quoted(key)}]`;
}

function ownDescriptor(
  value: object,
  key: PropertyKey,
  path: string,
): PropertyDescriptor {
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined) {
    return canonicalError(path, '包含不稳定的自有属性描述符');
  }
  return descriptor;
}

function dataValue(descriptor: PropertyDescriptor, path: string): unknown {
  if (!Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
    return canonicalError(path, '不接受 accessor 属性');
  }
  return descriptor.value;
}

function sortedKeys(keys: readonly string[]): string[] {
  return [...keys].sort((left, right) => (
    left < right ? -1 : left > right ? 1 : 0
  ));
}

function serializeArray(
  value: readonly unknown[],
  path: string,
  ancestors: Set<object>,
): string {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    return canonicalError(path, '只接受普通数组，不接受数组子类或自定义原型');
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    return canonicalError(path, '不接受 symbol key');
  }

  const descriptorsByIndex = new Map<number, PropertyDescriptor>();
  for (const key of ownKeys as string[]) {
    if (key === 'length') continue;

    const index = Number(key);
    if (
      !Number.isInteger(index)
      || index < 0
      || index >= value.length
      || String(index) !== key
    ) {
      return canonicalError(childPath(path, key), '不是合法的数组索引');
    }

    descriptorsByIndex.set(
      index,
      ownDescriptor(value, key, `${path}[${index}]`),
    );
  }

  if (descriptorsByIndex.size !== value.length) {
    return canonicalError(path, '不接受稀疏数组');
  }

  const serialized = new Array<string>(value.length);
  for (const [index, descriptor] of descriptorsByIndex) {
    if (!descriptor.enumerable) {
      return canonicalError(`${path}[${index}]`, '不接受不可枚举数组元素');
    }
    serialized[index] = serializeValue(
      dataValue(descriptor, `${path}[${index}]`),
      `${path}[${index}]`,
      ancestors,
    );
  }
  return `[${serialized.join(',')}]`;
}

function serializeRecord(
  value: object,
  path: string,
  ancestors: Set<object>,
): string {
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return canonicalError(path, '只接受 plain object 或 null-prototype object');
  }

  const ownKeys = Reflect.ownKeys(value);
  if (ownKeys.some((key) => typeof key === 'symbol')) {
    return canonicalError(path, '不接受 symbol key');
  }

  const keys = sortedKeys(ownKeys as string[]);
  const members = keys.map((key) => {
    const propertyPath = childPath(path, key);
    const descriptor = ownDescriptor(value, key, propertyPath);
    if (!descriptor.enumerable) {
      return canonicalError(propertyPath, '不接受不可枚举属性');
    }
    const member = serializeValue(dataValue(descriptor, propertyPath), propertyPath, ancestors);
    return `${quoted(key)}:${member}`;
  });
  return `{${members.join(',')}}`;
}

function serializeValue(
  value: unknown,
  path: string,
  ancestors: Set<object>,
): string {
  if (value === null) return 'null';

  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'string':
      return quoted(value);
    case 'number': {
      if (!Number.isFinite(value)) {
        return canonicalError(path, '不接受 NaN 或 Infinity');
      }
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        return canonicalError(path, '无法序列化数字');
      }
      return serialized;
    }
    case 'object': {
      if (ancestors.has(value)) {
        return canonicalError(path, '不接受循环引用');
      }

      ancestors.add(value);
      try {
        return Array.isArray(value)
          ? serializeArray(value, path, ancestors)
          : serializeRecord(value, path, ancestors);
      } finally {
        ancestors.delete(value);
      }
    }
    default:
      return canonicalError(path, `不接受 ${typeof value}`);
  }
}

/**
 * Serializes only the canonical JSON data model. Unlike JSON.stringify, this
 * function does not drop, coerce, or invoke accessors on ordinary values.
 * Callers must reject or clone Proxy objects at their ownership boundary.
 */
export function strictCanonicalStringify(value: unknown): string {
  return serializeValue(value, ROOT_PATH, new Set<object>());
}

/**
 * Hashes a canonical payload without coupling the domain to Node or Web Crypto.
 * The adapter owns UTF-8 SHA-256 and must return lowercase hexadecimal.
 */
export function hashCanonicalPayload(value: unknown, hashPort: HashPort): string {
  if (
    hashPort === null
    || typeof hashPort !== 'object'
    || typeof hashPort.sha256 !== 'function'
  ) {
    throw new TypeError('hashCanonicalPayload 需要同步 SHA-256 HashPort');
  }

  const digest = hashPort.sha256(strictCanonicalStringify(value));
  if (typeof digest !== 'string' || !SHA256_HEX.test(digest)) {
    throw new TypeError('HashPort 必须返回 64 位小写 SHA-256 十六进制字符串');
  }
  return digest;
}
