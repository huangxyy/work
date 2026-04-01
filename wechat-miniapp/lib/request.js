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
  console.log('[mergeArrayBuffers] Chunks:', arrays.length, 'Total length:', totalLength);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((item, index) => {
    console.log(`[mergeArrayBuffers] Chunk ${index}: length=${item.byteLength}`);
    merged.set(item, offset);
    offset += item.byteLength;
  });
  console.log('[mergeArrayBuffers] Final merged length:', merged.length);
  return merged.buffer;
}

function readFileBuffer(filePath) {
  return new Promise((resolve, reject) => {
    const fileSystem = wx.getFileSystemManager();
    fileSystem.readFile({
      filePath,
      success(res) {
        console.log('[readFileBuffer] Read result:', {
          filePath,
          dataType: typeof res.data,
          hasData: !!res.data,
          dataLength: res.data?.byteLength || res.data?.length || 0,
        });

        // 游客模式下，res.data 可能不是 ArrayBuffer
        if (res.data instanceof ArrayBuffer) {
          resolve(res.data);
          return;
        }

        // 如果是 base64 字符串，尝试解码
        if (typeof res.data === 'string') {
          // 移除 data:image/xxx;base64, 前缀（如果有）
          let base64 = res.data;
          if (base64.includes(',')) {
            base64 = base64.split(',')[1];
          }
          try {
            const binaryString = wx.base64ToArrayBuffer(base64);
            console.log('[readFileBuffer] Decoded base64 to ArrayBuffer, length:', binaryString.byteLength);
            resolve(binaryString);
            return;
          } catch (e) {
            console.error('[readFileBuffer] Base64 decode failed:', e);
          }
        }

        // 尝试直接使用
        if (res.data) {
          resolve(res.data);
          return;
        }

        reject({ message: '无法读取图片数据' });
      },
      fail(err) {
        console.error('[readFileBuffer] Read failed:', err);
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

const MIN_VALID_FILE_SIZE = 100;

function parseErrorResponse(filePath) {
  return new Promise((resolve) => {
    const fileSystem = wx.getFileSystemManager();
    fileSystem.readFile({
      filePath,
      encoding: 'utf8',
      success(fileRes) {
        try {
          const errorData = JSON.parse(fileRes.data);
          console.error('[downloadFile] Server error in file:', errorData);
          resolve({
            isError: true,
            errorData,
            message: errorData.message || errorData.error || '服务器返回错误',
          });
        } catch (parseError) {
          console.error('[downloadFile] Failed to parse error response:', parseError);
          resolve({
            isError: true,
            message: fileRes.data || '服务器返回错误',
          });
        }
      },
      fail() {
        resolve({ isError: false });
      },
    });
  });
}

function downloadFile(options) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const fullUrl = buildUrlWithQuery(options.url, options.data);
    console.log('[downloadFile] URL:', fullUrl);
    console.log('[downloadFile] Token exists:', !!token);
    wx.downloadFile({
      url: fullUrl,
      timeout: options.timeout || 60000,
      header: {
        ...(options.header || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(res) {
        console.log('[downloadFile] Response:', {
          statusCode: res.statusCode,
          tempFilePath: res.tempFilePath,
          hasTempFilePath: !!res.tempFilePath,
        });
        const { statusCode, tempFilePath } = res;

        if (statusCode === 401) {
          clearSession();
          redirectToLogin();
          reject({
            statusCode,
            message: '登录已过期，请重新登录',
          });
          return;
        }

        if (statusCode >= 400) {
          if (tempFilePath) {
            parseErrorResponse(tempFilePath).then((parseResult) => {
              if (parseResult.isError) {
                reject({
                  statusCode,
                  message: parseResult.message,
                  errorData: parseResult.errorData,
                });
              } else {
                reject({
                  statusCode,
                  message: `下载失败 (状态码: ${statusCode})`,
                });
              }
            });
          } else {
            reject({
              statusCode,
              message: `下载失败 (状态码: ${statusCode})`,
            });
          }
          return;
        }

        if (!tempFilePath) {
          reject({
            statusCode,
            message: '下载失败：未获取到文件',
          });
          return;
        }

        if (statusCode >= 200 && statusCode < 300) {
          const fileSystem = wx.getFileSystemManager();
          fileSystem.stat({
            path: tempFilePath,
            success(statRes) {
              const stats = Array.isArray(statRes.stats) ? statRes.stats[0] : statRes.stats;
              const fileSize = stats && stats.size ? stats.size : 0;
              console.log('[downloadFile] File size:', fileSize);

              if (fileSize < MIN_VALID_FILE_SIZE) {
                console.warn('[downloadFile] File too small, might be error response');
                parseErrorResponse(tempFilePath).then((parseResult) => {
                  if (parseResult.isError) {
                    reject({
                      statusCode,
                      message: parseResult.message,
                      errorData: parseResult.errorData,
                      isSmallFile: true,
                    });
                  } else {
                    resolve(res);
                  }
                });
              } else {
                resolve(res);
              }
            },
            fail(statErr) {
              console.warn('[downloadFile] Failed to stat file:', statErr);
              resolve(res);
            },
          });
          return;
        }

        reject({
          statusCode,
          tempFilePath,
          message: `下载失败 (状态码: ${statusCode})`,
        });
      },
      fail(err) {
        console.error('[downloadFile] Request failed:', err);
        reject({
          message: err && err.errMsg ? err.errMsg : '下载失败，请稍后重试',
          err,
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

  console.log('[uploadFiles] formData:', formData);
  console.log('[uploadFiles] files count:', files.length);
  console.log('[uploadFiles] fieldName:', fieldName);

  // 添加表单字段
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

  // 使用 base64 读取文件
  for (let index = 0; index < files.length; index += 1) {
    const current = files[index];
    const fileName = (current.name || `image-${index + 1}.jpg`).replace(/"/g, '');
    const mimeType = current.type || 'image/jpeg';

    // 使用 base64 编码读取文件
    const fileBuffer = await new Promise((resolve, reject) => {
      const fileSystem = wx.getFileSystemManager();
      fileSystem.readFile({
        filePath: current.path,
        encoding: 'base64',
        success(res) {
          console.log(`[readFileBuffer] file ${index} base64 length:`, res.data?.length || 0);
          if (!res.data) {
            reject(new Error('文件读取失败'));
            return;
          }
          // 将 base64 转换为 ArrayBuffer
          const binaryString = wx.base64ToArrayBuffer(res.data);
          console.log(`[readFileBuffer] file ${index} converted to ArrayBuffer, length:`, binaryString.byteLength);
          resolve(binaryString);
        },
        fail(err) {
          console.error(`[readFileBuffer] file ${index} read failed:`, err);
          reject(err);
        },
      });
    });

    chunks.push(
      encodeUtf8(
        `--${boundary}${lineBreak}Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"${lineBreak}Content-Type: ${mimeType}${lineBreak}${lineBreak}`,
      ),
    );
    chunks.push(new Uint8Array(fileBuffer));
    chunks.push(encodeUtf8(lineBreak));

    if (typeof options.onProgress === 'function') {
      const percent = Math.min(88, Math.round(((index + 1) / files.length) * 72) + 12);
      options.onProgress(percent);
    }
  }

  chunks.push(encodeUtf8(`--${boundary}--${lineBreak}`));

  // 合并所有 chunks
  const arrays = chunks.map((chunk) => toUint8Array(chunk));
  const totalLength = arrays.reduce((sum, item) => sum + item.byteLength, 0);
  console.log('[mergeArrayBuffers] Total chunks:', arrays.length, 'Total length:', totalLength);

  const merged = new Uint8Array(totalLength);
  let offset = 0;
  arrays.forEach((item) => {
    merged.set(item, offset);
    offset += item.byteLength;
  });
  const requestBody = merged.buffer;

  console.log('[uploadFiles] Request body size:', requestBody.byteLength);
  console.log('[uploadFiles] Token exists:', !!token);

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
        console.log('[uploadFiles] Response:', { statusCode: res.statusCode, data: res.data });
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
        console.error('[uploadFiles] Error response:', parsed);
        reject({
          statusCode,
          data: parsed,
          message: pickErrorMessage(parsed, '上传失败'),
        });
      },
      fail(err) {
        console.error('[uploadFiles] Request failed:', err);
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
