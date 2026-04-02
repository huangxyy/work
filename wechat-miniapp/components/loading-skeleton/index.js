Component({
  properties: {
    count: {
      type: Number,
      value: 3
    },
    type: {
      type: String,
      value: 'card'
    }
  },

  data: {
    items: []
  },

  observers: {
    'count': function(count) {
      this.setData({
        items: Array.from({ length: count }, (_, i) => i)
      });
    }
  },

  attached() {
    this.setData({
      items: Array.from({ length: this.data.count }, (_, i) => i)
    });
  }
});
