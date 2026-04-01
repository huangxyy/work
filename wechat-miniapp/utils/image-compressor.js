/**
 * 图片压缩工具
 * 用于微信小程序图片上传前的压缩处理
 */

/**
 * 压缩图片
 * @param {string} filePath - 图片临时路径
 * @param {number} quality - 压缩质量 0-100，默认 80
 * @param {number} maxWidth - 最大宽度，默认 1200
 * @returns {Promise<string>} 压缩后的临时路径
 */
function compressImage(filePath, quality = 80, maxWidth = 1200) {
  return new Promise((resolve, reject) => {
    // 获取图片信息
    wx.getImageInfo({
      src: filePath,
      success: (info) => {
        let { width, height } = info;

        // 计算压缩后的尺寸
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        // 压缩图片
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
            // 压缩失败，返回原图
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
async function compressImages(filePaths, quality = 80, maxWidth = 1200) {
  const results = [];
  for (const filePath of filePaths) {
    try {
      const compressed = await compressImage(filePath, quality, maxWidth);
      results.push(compressed);
    } catch (err) {
      results.push(filePath); // 失败时使用原图
    }
  }
  return results;
}

module.exports = {
  compressImage,
  compressImages
};
