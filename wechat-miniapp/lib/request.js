const { getApiBaseUrl } = require('./config');
const { getToken, clearSession } = require('./auth');
const { pickErrorMessage } = require('./utils');

function buildUrl(path) {
  const baseUrl = getApiBaseUrl();
  if (!path.startsWith('/')) {
    return `${baseUrl}/${path}`;
  }
  return `${baseUrl}${path}`;
}

function buildQueryString(params) {
  if (!params || typeof params !== 'object') {
    return '';
  }
  return Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
}

function buildUrlWithQuery(path, params) {
  const url = buildUrl(path);
  const queryString = buildQueryString(params);
  if (!queryString) {
    return url;
  }
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
}

function getCurrentPageUrl() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1];
  if (!current || !current.route) {
    return '/pages/homeworks/index';
  }
  const query = Object.keys(current.options || {})
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(current.options[key])}`)
    .join('&');
  return `/${current.route}${query ? `?${query}` : ''}`;
}

function redirectToLogin() {
  const currentUrl = getCurrentPageUrl();
  if (currentUrl.startsWith('/pages/login/index')) {
    return;
  }
  wx.reLaunch({
    url: `/pages/login/index?from=${encodeURIComponent(currentUrl)}`,
  });
}

function encodeUtf8(input) {
  const encoded = encodeURIComponent(input);
  const bytes = [];
  for (let index = 0; index < encoded.length; index += 1) {
    const char = encoded[index];
    if (char === '%') {
      bytes.push(parseInt(encoded.slice(index + 1, index + 3), 16));
      index += 2;
    } else {
      bytes.push(char.charCodeAt(0));
    }
  }
  return new Uint8Array(bytes);
}

function toUint8Array(chunk) {
  if (chunk instanceof ArrayBuffer) {
    return new Uint8Array(chunk);
  }
  if (ArrayBuffer.isView(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  return encodeUtf8(String(chunk || ''));
}

function mergeArrayBuffers(chunks) {
  const arrays = chunks.map((chunk) => toUint8Array(chunk));
  const totalLength = arrays.reduce((sum, item) => sum + item.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((item) => {
    merged.set(item, offset);
    offset += item.byteLength;
  });
  return merged.buffer;
}

function readFileBuffer(filePath) {
  return new Promise((resolve, reject) => {
    const fileSystem = wx.getFileSystemManager();
    fileSystem.readFile({
      filePath,
      success(res) {
        resolve(res.data);
      },
      fail(err) {
        reject({ message: err && err.errMsg ? err.errMsg : '读取图片失败' });
      },
    });
  });
}

function request(options) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.request({
      url: buildUrl(options.url),
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 30000,
      header: {
        'Content-Type': 'application/json',
        ...(options.header || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        const { statusCode, data } = res;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data);
          return;
        }
        if (statusCode === 401) {
          clearSession();
          redirectToLogin();
        }
        reject({
          statusCode,
          data,
          message: pickErrorMessage(data, '请求失败'),
        });
      },
      fail(err) {
        reject({
          message: err && err.errMsg ? err.errMsg : '网络异常，请稍后重试',
        });
      },
    });
  });
}

function downloadFile(options) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    wx.downloadFile({
      url: buildUrlWithQuery(options.url, options.data),
      timeout: options.timeout || 60000,
      header: {
        ...(options.header || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        const { statusCode, tempFilePath } = res;
        if (statusCode >= 200 && statusCode < 300 && tempFilePath) {
          resolve(res);
          return;
        }
        if (statusCode === 401) {
          clearSession();
          redirectToLogin();
        }
        reject({
          statusCode,
          data: res,
          message: pickErrorMessage(res, '下载失败'),
        });
      },
      fail(err) {
        reject({
          message: err && err.errMsg ? err.errMsg : '下载失败，请稍后重试',
        });
      },
    });
  });
}

async function uploadFiles(options) {
  const token = getToken();
  const files = options.files || [];
  if (!files.length) {
    return Promise.reject({ message: '请至少选择一张图片' });
  }
  if (typeof options.onProgress === 'function') {
    options.onProgress(8);
  }

  const boundary = `----HomeworkMiniApp${Date.now().toString(16)}`;
  const lineBreak = '\r\n';
  const chunks = [];
  const formData = options.formData || {};
  const fieldName = options.name || 'images';

  Object.keys(formData).forEach((key) => {
    const value = formData[key];
    if (value === undefined || value === null) {
      return;
    }
    chunks.push(
      encodeUtf8(
        `--${boundary}${lineBreak}Content-Disposition: form-data; name="${key}"${lineBreak}${lineBreak}${String(value)}${lineBreak}`,
      ),
    );
  });

  for (let index = 0; index < files.length; index += 1) {
    const current = files[index];
    const fileBuffer = await readFileBuffer(current.path);
    const encodedName = encodeURIComponent(current.name || `image-${index + 1}.jpg`);
    const mimeType = current.type || 'image/jpeg';
    chunks.push(
      encodeUtf8(
        `--${boundary}${lineBreak}Content-Disposition: form-data; name="${fieldName}"; filename="${encodedName}"${lineBreak}Content-Type: ${mimeType}${lineBreak}${lineBreak}`,
      ),
    );
    chunks.push(fileBuffer);
    chunks.push(encodeUtf8(lineBreak));
    if (typeof options.onProgress === 'function') {
      const percent = Math.min(88, Math.round(((index + 1) / files.length) * 72) + 12);
      options.onProgress(percent);
    }
  }

  chunks.push(encodeUtf8(`--${boundary}--${lineBreak}`));
  const requestBody = mergeArrayBuffers(chunks);

  if (typeof options.onProgress === 'function') {
    options.onProgress(92);
  }

  return new Promise((resolve, reject) => {
    wx.request({
      url: buildUrl(options.url),
      method: options.method || 'POST',
      data: requestBody,
      timeout: options.timeout || 60000,
      header: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        ...(options.header || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        const { statusCode } = res;
        let parsed = res.data;
        if (typeof parsed === 'string') {
          try {
            parsed = JSON.parse(parsed);
          } catch (_error) {
          }
        }
        if (statusCode >= 200 && statusCode < 300) {
          if (typeof options.onProgress === 'function') {
            options.onProgress(100);
          }
          resolve(parsed);
          return;
        }
        if (statusCode === 401) {
          clearSession();
          redirectToLogin();
        }
        reject({
          statusCode,
          data: parsed,
          message: pickErrorMessage(parsed, '上传失败'),
        });
      },
      fail(err) {
        reject({
          message: err && err.errMsg ? err.errMsg : '上传失败',
        });
      },
    });
  });
}

module.exports = {
  request,
  downloadFile,
  uploadFiles,
};
