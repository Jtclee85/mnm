/**
 * TextEncoder/TextDecoder 기반 Unicode-safe base64 인코딩
 * btoa/atob 단독 사용 시 한글이 깨지는 문제를 방지
 */
export const encodeShareData = (obj) => {
  const json = JSON.stringify(obj);
  const bytes = new TextEncoder().encode(json);
  const binary = Array.from(bytes, b => String.fromCharCode(b)).join('');
  return btoa(binary);
};

export const decodeShareData = (str) => {
  try {
    const binary = atob(str);
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
};
