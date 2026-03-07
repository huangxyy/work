const SUBMIT_DRAFT_PREFIX = 'submit_draft_';

function hasSubmitDraftContent(draft) {
  if (!draft || typeof draft !== 'object') {
    return false;
  }
  const hasFiles = Array.isArray(draft.files) && draft.files.length > 0;
  const hasModeChange = Number.isInteger(Number(draft.modeIndex)) && Number(draft.modeIndex) > 0;
  const hasRewriteChange = draft.needRewrite === false;
  return hasFiles || hasModeChange || hasRewriteChange;
}

function isPersistentFilePath(filePath) {
  return typeof filePath === 'string' && filePath.indexOf('wxfile://usr/') === 0;
}

function removeSavedFile(filePath) {
  if (!isPersistentFilePath(filePath)) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    wx.removeSavedFile({
      filePath,
      complete() {
        resolve();
      },
    });
  });
}

function listSubmitDraftEntries() {
  try {
    const storageInfo = wx.getStorageInfoSync();
    const keys = (storageInfo.keys || []).filter((key) => key.indexOf(SUBMIT_DRAFT_PREFIX) === 0);
    return keys.map((key) => ({
      key,
      draft: wx.getStorageSync(key) || null,
    }));
  } catch (_error) {
    return [];
  }
}

function getSubmitDraftStorageKey(homeworkId) {
  return `${SUBMIT_DRAFT_PREFIX}${homeworkId || ''}`;
}

function getSubmitDraft(homeworkId) {
  try {
    return wx.getStorageSync(getSubmitDraftStorageKey(homeworkId)) || null;
  } catch (_error) {
    return null;
  }
}

function hasSubmitDraft(homeworkId) {
  const draft = getSubmitDraft(homeworkId);
  return hasSubmitDraftContent(draft);
}

function getSubmitDraftCount() {
  return listSubmitDraftEntries().filter((item) => hasSubmitDraftContent(item.draft)).length;
}

async function clearAllSubmitDrafts() {
  const entries = listSubmitDraftEntries();
  const filePaths = Array.from(new Set(entries.flatMap((item) => {
    if (!item.draft || !Array.isArray(item.draft.files)) {
      return [];
    }
    return item.draft.files
      .map((file) => file && file.path)
      .filter((filePath) => isPersistentFilePath(filePath));
  })));
  await Promise.all(filePaths.map((filePath) => removeSavedFile(filePath)));
  entries.forEach((item) => {
    try {
      wx.removeStorageSync(item.key);
    } catch (_error) {
    }
  });
  return entries.length;
}

module.exports = {
  SUBMIT_DRAFT_PREFIX,
  getSubmitDraftStorageKey,
  getSubmitDraft,
  hasSubmitDraft,
  getSubmitDraftCount,
  clearAllSubmitDrafts,
};
