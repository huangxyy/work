/**
 * 图片压缩工具
 * 用于微信小程序图片上传前的压缩处理
 */

const COMPRESS_QUALITY = 80;
const COMPRESS_MAX_WIDTH = 1200;

/**
 * 压缩图片
 * @param {string} filePath - 图片临时路径
 * @param {number} quality - 压缩质量 0-100，默认使用 COMPRESS_QUALITY
 * @param {number} maxWidth - 最大宽度，默认使用 COMPRESS_MAX_WIDTH
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressImage(filePath, quality = COMPRESS_QUALITY, maxWidth = COMPRESS_MAX_WIDTH) {
  return new Promise((resolve, reject) => {
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        let { width, height } = info;

        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        wx.compressImage({
          src: filePath,
          quality,
          width,
          height,
          success: (res) => {
            resolve(res.tempFilePath);
          },
          fail: (err) => {
            console.error('图片压缩失败:', err);
            resolve(filePath);
          }
        });
      },
      fail: (err) => {
        console.error('获取图片信息失败:', err);
        reject(err);
      }
    });
  });
}

/**
 * 压缩多张图片
 * @param {Array<string>} filePaths - 图片路径数组
 * @param {number} quality - 压缩质量
 * @param {number} maxWidth - 最大宽度
 * @returns {Promise<Array<string>>} 压缩后的路径数组
 */
async function compressImages(filePaths, quality = COMPRESS_QUALITY, maxWidth = COMPRESS_MAX_WIDTH) {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const compressed = await compressImage(filePath, quality, maxWidth);
      results.push(compressed);
    } catch (err) {
      results.push(filePath);
    }
  }
  return results;
}

module.exports = {
  compressImage,
  compressImages,
  COMPRESS_QUALITY,
  COMPRESS_MAX_WIDTH,
};
