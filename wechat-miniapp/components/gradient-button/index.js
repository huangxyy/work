// components/gradient-button/index.js
Component({
  options: {
    styleIsolation: 'shared',
    multipleSlots: true
  },
  properties: {
    // 按钮尺寸: small, medium, large
    size: {
      type: String,
      value: 'medium'
    },
    // 是否禁用
    disabled: {
      type: Boolean,
      value: false
    },
    // 按钮类型: primary, secondary (可扩展更多类型)
    type: {
      type: String,
      value: 'primary'
    }
  },
  methods: {
    handleTap(e) {
      if (!this.data.disabled) {
        this.triggerEvent('tap', e.detail);
      }
    }
  }
});
