//clinc.js

// 导入模块
const api = require('../../utils/api.js');
const { RoleCode, RoleUtil } = require('../../utils/role-enum.js');
const session = require('../../utils/session.js');

/**
 * 定期就诊提醒页面
 */
Page({
  /**
   * 页面初始数据
   */
  data: {
    // 分页参数
    page: 1,
    size: 10,
    total: 0,
    pages: 0,
    pageSizeOptions: ['10', '20', '50', '100'],
    pageSizeIndex: 0,
    
    // 搜索参数
    searchParams: {
      name: '',
      idNo: '',
      phone: ''
    },
    
    // 数据列表
    reminderList: [],
    
    // 状态标志
    isLoading: false,
    
    // 用户角色信息
    userRoleBit: null,
    isNormalUser: false,
    isProfessionalUser: false,
    userRoleDescriptions: ['未知用户']
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    console.log('定期就诊提醒页面加载');
    
    // 注册到全局通知系统
    const app = getApp();
    app.registerPage(this);
    
    // 获取用户角色
    this.checkUserRole();
  },
  
  /**
   * 计算两个日期之间的天数差
   * @param {string} dateStr - 日期字符串（YYYY-MM-DD格式）
   * @returns {number} 天数差
   */
  getDaysDiff: function(dateStr) {
    try {
      // 解析日期字符串
      const targetDate = new Date(dateStr);
      const today = new Date();
      
      // 设置时间为00:00:00，只比较日期部分
      targetDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      
      // 计算毫秒差并转换为天数
      const diffTime = Math.abs(targetDate - today);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays;
    } catch (error) {
      console.error('日期计算错误:', error);
      return 999; // 默认返回大值，表示不是紧急日期
    }
  },
  
  /**
   * 标记紧急提醒记录
   * @param {Array} dataList - 提醒记录列表
   * @returns {Array} 添加了isUrgent属性的记录列表
   */
  markUrgentRecords: function(dataList) {
    return dataList.map(item => {
      // 假设下次就诊日期字段为 nextVisitDate
      const nextVisitDate = item.nextVisitDate || item.visitDate || '';
      const daysDiff = this.getDaysDiff(nextVisitDate);
      
      // 添加isUrgent属性：距离今天不足两天为紧急
      return {
        ...item,
        isUrgent: daysDiff < 2
      };
    });
  },
  
  /**
   * 判断日期是否为紧急提醒（不足两天）
   * 用于WXML模板中直接调用
   * @param {string} dateStr - 日期字符串
   * @returns {boolean} 是否为紧急提醒
   */
  isUrgent: function(dateStr) {
    return this.getDaysDiff(dateStr) < 2;
  },
  
  /**
   * 检查用户角色
   */
  checkUserRole: function() {
    // 从会话中获取用户角色位图
    const userRoleBit = session.getRoleBit();
    
    // 判断用户角色类型
    const isNormalUser = RoleUtil.isNormalUser(userRoleBit);
    const isProfessionalUser = RoleUtil.isProfessionalUser(userRoleBit);
    const userRoleDescriptions = RoleUtil.getUserRoleDescriptions(userRoleBit);
    
    console.log('用户角色检查:', {
      userRoleBit,
      isNormalUser,
      isProfessionalUser,
      userRoleDescriptions
    });
    
    // 更新页面数据
    this.setData({
      userRoleBit,
      isNormalUser,
      isProfessionalUser,
      userRoleDescriptions
    });
    
    // 初始加载数据
    this.loadReminderData();
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function() {
    console.log('定期就诊提醒页面渲染完成');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function() {
    console.log('定期就诊提醒页面显示');
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function() {
    console.log('定期就诊提醒页面隐藏');
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function() {
    console.log('定期就诊提醒页面卸载');
    // 从全局通知系统注销
    const app = getApp();
    if (app && typeof app.unregisterPage === 'function') {
      app.unregisterPage(this);
    }
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function() {
    console.log('下拉刷新');
    // 重置为第一页并重新加载
    this.setData({ page: 1 });
    this.loadReminderData(() => {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 监听用户点击页面内转发按钮
   * @returns {Object} 转发配置
   */
  onShareAppMessage: function() {
    return {
      title: '定期就诊提醒',
      path: '/pages/clinc/clinc'
    };
  },
  
  /**
   * 获取就诊提醒记录数据
   * @param {Function} callback - 回调函数
   */
  loadReminderData: function(callback) {
    const { isNormalUser, isProfessionalUser, page, size, searchParams } = this.data;
    
    // 根据用户角色构建不同的请求参数
    let params = {};
    
    if (isNormalUser) {
      // 普通用户：固定获取1条自己的数据，不需要搜索参数
      console.log('普通用户模式：获取自己的最新一条记录');
      params = {
        page: 1,
        size: 1
      };
    } else if (isProfessionalUser) {
      // 专业用户：支持分页和搜索
      console.log('专业用户模式：支持多记录查询');
      params = {
        page: page,
        size: size,
        name: searchParams.name,
        idNo: searchParams.idNo,
        phone: searchParams.phone
      };
    } else {
      // 其他用户角色：默认获取1条数据
      console.log('其他用户角色：默认查询模式');
      params = {
        page: 1,
        size: 1
      };
    }
    
    // 设置加载状态
    this.setData({ isLoading: true });
    
    // 调用API获取数据
    api.get('/rest/clinc/prescription/reminder/list', params)
      .then(res => {
        console.log('获取就诊提醒记录成功:', res);
        
        if (res.code === '0' && res.data) {
            // 确保数据是数组格式
            let dataList = Array.isArray(res.data) ? res.data : [];
            
            // 标记紧急提醒记录
            dataList = this.markUrgentRecords(dataList);
            
            // 对于普通用户，如果有多条数据（意外情况），只保留第一条
            if (isNormalUser && dataList.length > 1) {
              dataList = [dataList[0]];
            }
            
            this.setData({
              reminderList: dataList,
              total: res.total || dataList.length,
              pages: res.pages || 1
            });
          } else {
          wx.showToast({
            title: res.msg || '获取数据失败',
            icon: 'none'
          });
        }
      })
      .catch(err => {
        console.error('获取就诊提醒记录失败:', err);
        wx.showToast({
          title: '网络异常，请稍后重试',
          icon: 'none'
        });
      })
      .finally(() => {
        // 取消加载状态
        this.setData({ isLoading: false });
        
        // 执行回调
        if (typeof callback === 'function') {
          callback();
        }
      });
  },
  
  /**
   * 姓名输入处理
   */
  onNameInput: function(e) {
    this.setData({
      'searchParams.name': e.detail.value
    });
  },
  
  /**
   * 证件号输入处理
   */
  onIdNoInput: function(e) {
    this.setData({
      'searchParams.idNo': e.detail.value
    });
  },
  
  /**
   * 手机号输入处理
   */
  onPhoneInput: function(e) {
    this.setData({
      'searchParams.phone': e.detail.value
    });
  },
  
  /**
   * 搜索按钮点击事件
   */
  onSearch: function() {
    // 重置为第一页
    this.setData({ page: 1 });
    // 加载数据
    this.loadReminderData();
  },
  
  /**
   * 重置按钮点击事件
   */
  onReset: function() {
    // 重置搜索参数
    this.setData({
      searchParams: {
        name: '',
        idNo: '',
        phone: ''
      },
      page: 1
    });
    // 加载数据
    this.loadReminderData();
  },
  
  /**
   * 上一页
   */
  prevPage: function() {
    if (this.data.page > 1) {
      this.setData({ page: this.data.page - 1 });
      this.loadReminderData();
    }
  },
  
  /**
   * 下一页
   */
  nextPage: function() {
    if (this.data.page < this.data.pages) {
      this.setData({ page: this.data.page + 1 });
      this.loadReminderData();
    }
  },
  
  /**
   * 每页显示条数变化
   */
  onPageSizeChange: function(e) {
    const index = e.detail.value;
    const size = parseInt(this.data.pageSizeOptions[index]);
    
    this.setData({
      pageSizeIndex: index,
      size: size,
      page: 1 // 重置为第一页
    });
    
    this.loadReminderData();
  },
  
  /**
   * 判断下次就诊日期是否紧急（7天内）
   */
  isUrgent: function(nextDateStr) {
    if (!nextDateStr) return false;
    
    try {
      const nextDate = new Date(nextDateStr);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      nextDate.setHours(0, 0, 0, 0);
      
      const diffTime = nextDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return diffDays >= 0 && diffDays <= 7;
    } catch (error) {
      console.error('日期判断错误:', error);
      return false;
    }
  }
});
