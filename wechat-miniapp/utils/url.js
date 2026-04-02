function normalizeImageUrl(url) {
  if (!url || typeof url !== 'string') {
    return url;
  }

  // 开发环境：如果是 localhost 或 127.0.0.1，保持 HTTP
  // 生产环境：将 HTTP 转换为 HTTPS
  const isDev = __wxConfig.envVersion === 'develop' || __wxConfig.envVersion === 'trial';

  if (isDev) {
    // 开发环境不转换协议
    return url;
  }

  // 生产环境：将 HTTP 转换为 HTTPS
  if (url.startsWith('http://')) {
    return url.replace('http://', 'https://');
  }

  return url;
}

module.exports = {
  normalizeImageUrl,
};
