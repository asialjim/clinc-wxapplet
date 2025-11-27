//clinc.js

// 导入API模块
const api = require('../../utils/api.js');
// 导入URL构建工具
const { rest } = require('../../utils/url.js');
// 导入角色相关模块
const {RoleCode, RoleUtil} = require('../../utils/role-enum.js')
const session = require('../../utils/session.js');

/**
 * 定期就诊提醒页面
 */
Page({
  /**
   * 页面初始数据
   */
  data: {
    // 用户角色信息
    userInfo: null,
    isNormalUser: false,
    isProfessionalUser: false,
    
    // 分页参数
    page: 1,
    size: 3,
    total: 0,
    pages: 0,
    pageSizeOptions: ['3', '5', '10'],
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
    isLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function () {
    console.log('定期就诊提醒页面加载');
    
    // 注册到全局通知系统
    const app = getApp();
    app.registerPage(this);
    
    // 检查用户角色
    this.checkUserRole();
  },
  
  /**
   * 检查用户角色并初始化数据
   */
  checkUserRole: function() {
    try {
      // 获取用户信息
      const userInfo = session.get('userInfo') || {};
      console.log('当前用户信息:', userInfo);
      
      // 获取用户角色位图
      const roleBit = userInfo.roleBit || 0;
      console.log('当前用户角色位图:', roleBit);
      
      // 使用RoleUtil中定义的方法判断用户类型
      const isNormalUser = RoleUtil.isNormalUser(roleBit);
      // 专业用户包括医护人员和管理员
      const isProfessionalUser = RoleUtil.isProfessionalUser(roleBit) || RoleUtil.isAdmin(roleBit);
      
      // 获取用户角色描述
      const roleDescriptions = RoleUtil.getUserRoleDescriptions(roleBit);
      console.log('用户角色描述:', roleDescriptions);
      
      // 更新用户角色状态
      this.setData({
        userInfo: userInfo,
        isNormalUser: isNormalUser,
        isProfessionalUser: isProfessionalUser
      });
      
      console.log('用户角色检查结果: isNormalUser=' + isNormalUser + ', isProfessionalUser=' + isProfessionalUser);
      
      // 初始加载数据
      this.loadReminderData();
      
    } catch (error) {
      console.error('检查用户角色失败:', error);
      // 出错时默认为普通用户
      this.setData({
        isNormalUser: true,
        isProfessionalUser: false
      });
      // 尝试加载数据
      this.loadReminderData();
    }
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
    const { page, size, searchParams, isProfessionalUser, isNormalUser } = this.data;
    
    // 根据用户角色构建不同的请求参数
    let params = {};
    
    if (isProfessionalUser) {
      // 专业用户：使用完整的分页和搜索功能
      params = {
        page: page,
        size: size,
        name: searchParams.name,
        idNo: searchParams.idNo,
        phone: searchParams.phone
      };
      console.log('专业用户加载就诊提醒记录，参数:', params);
    } else if (isNormalUser) {
      // 普通用户：不分页，不使用搜索功能
      // 这里可以根据实际需求调整普通用户的查询参数
      params = {
        // 普通用户可能只需要自身的数据
        size: 100 // 给普通用户一个合理的较大数量限制
      };
      console.log('普通用户加载就诊提醒记录，参数:', params);
    }
    
    console.log('加载就诊提醒记录，参数:', params);
    
    // 设置加载状态
    this.setData({ isLoading: true });
    
    // 构建完整的REST API URL并调用
    const apiUrl = rest('/clinc/prescription/reminder/list', params);
    console.log('API请求URL:', apiUrl);
    api.get(apiUrl,  {pageCallable: data => {
        console.log('分页结果:', data);
           this.setData({
            page: data.page || 1,
            total: data.total || 0,
            pages: data.pages || 1
            });
    }, throwCallable: err => {
          wx.showToast({
            title: err.msg || '获取数据失败', 
            icon: 'none'
          });
    }})
      .then(res => {
        console.log('获取就诊提醒记录成功:', res);
            // 确保数据是数组格式
            let dataList = Array.isArray(res) ? res : [];
            
            // 标记紧急提醒记录
            dataList = this.markUrgentRecords(dataList);
            
            // 根据用户角色处理数据
            if (isNormalUser) {
              // 普通用户：只显示前N条数据（如果需要）
              // 这里可以根据实际需求调整普通用户的数据展示数量
              const MAX_NORMAL_USER_RECORDS = 20;
              if (dataList.length > MAX_NORMAL_USER_RECORDS) {
                dataList = dataList.slice(0, MAX_NORMAL_USER_RECORDS);
                console.log('普通用户数据已截断为', MAX_NORMAL_USER_RECORDS, '条');
              }
            }
            
            // 更新页面数据
            this.setData({
              reminderList: dataList,
              total: isProfessionalUser ? (res.total || dataList.length) : dataList.length,
              pages: isProfessionalUser ? (res.pages || 1) : 1
            });
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
   * 判断下次就诊日期是否为7天内的提醒
   */
  isUpcoming: function(nextDateStr) {
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
