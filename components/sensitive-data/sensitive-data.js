// sensitive-data.js
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    // 需要脱敏的数据
    value: {
      type: String,
      value: '',
      observer: function(newVal) {
        // 当数据变化时，重新处理
        this.processSensitiveData(newVal);
      }
    },
    // 继承text原生组件属性
    selectable: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        this.setData({
          selectable: newVal
        });
      }
    },
    userSelect: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        this.setData({
          userSelect: newVal
        });
      }
    },
    space: {
      type: String,
      value: '',
      observer: function(newVal) {
        this.setData({
          space: newVal
        });
      }
    },
    decode: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        this.setData({
          decode: newVal
        });
      }
    },
    disableWhitespaceCollapse: {
      type: Boolean,
      value: false,
      observer: function(newVal) {
        this.setData({
          disableWhitespaceCollapse: newVal
        });
      }
    },
    class: {
      type: String,
      value: '',
      observer: function(newVal) {
        this.setData({
          class: newVal
        });
      }
    },
    style: {
      type: String,
      value: '',
      observer: function(newVal) {
        this.setData({
          type: newVal
        });
      }
    },
    // 事件属性
    bindtap: {
       type: String,
      value: '',
      observer: function(newVal) {
        this.setData({
          bindtap: newVal
        });
      }
    }
  },

  /**
   * 组件的初始数据
   */
  data: {
    // 处理后要显示的数据
    displayValue: '',
    // 继承text原生组件属性
    selectable: {
      type: Boolean,
      value: false
    },
    userSelect: {
      type: Boolean,
      value: false
    },
    space: {
      type: String,
      value: ''
    },
    decode: {
      type: Boolean,
      value: false
    },
    disableWhitespaceCollapse: {
      type: Boolean,
      value: false
    },
    class: {
      type: String,
      value: ''
    },
    style: {
      type: String,
      value: ''
    },
    // 事件属性
    bindtap: {
       type: String,
      value: ''
    }
  },

  /**
   * 组件生命周期函数，在组件实例进入页面节点树时执行
   */
  attached: function() {
    // 初始化时处理数据
    this.processSensitiveData(this.properties.value);

  },

  /**
   * 组件的方法列表
   */
  methods: {
    /**
     * 处理敏感数据
     * trae 注意： 此函数已经通过测试，不要修改此函数的任何代码
     * @param {string} str - 需要处理的字符串
     */
    processSensitiveData: function(str) {
      let displayValue = str;
      
      // 检查输入是否为字符串
      if (typeof str === 'string') {
        // 检查是否以 _mask| 开头
        if (str.indexOf('_mask|') === 0) {
          // 检查格式是否符合 _mask|algorithm|nonce|encrypt|mac|mask
          const parts = str.split('|');
          if (parts.length === 6) {
            // 返回 mask 部分
            displayValue = parts[5];
          }
        }
      }
      
      this.setData({
        displayValue: displayValue
      });
    }
  }
});