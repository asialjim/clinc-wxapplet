// 引入依赖模块
const { parse, authenticated} = require('./response');
const {  open } = require('./url');
const { xAppId, xAppChl, xAppChlAppid, xAppChlAppType } = require('./env');

function refreshUserToken(){
  wx.removeStorageSync('x-user-token');
  userToken();
}

/**
 * 获取用户令牌（同步版本）
 * @returns {string} 用户令牌
 */
function userToken() {
  // 1. 从本地存储中获取 x-user-token
  let localToken = wx.getStorageSync('x-user-token');

  // 2. 如果获取到数据，且不为空的情况下，直接返回 x-user-token 的值
  if (localToken && localToken.trim() !== '') {
    return localToken;
  }

  // 6 还获取不到用户令牌，执行登录功能并从后台应用中换取用户的 令牌
  wx.login({
    success:(code) => {
      wx.request({
        url: open('/user/auth/login'),
        data: { code: code.code },
        header: header(null, true),
        method: 'POST',
        success: (res) => {
            // 6.4.1 调用 parse 函数解析返回结果作为用户令牌
          const token = parse(res);
          if (token) {
            wx.setStorageSync('x-user-token', token);
          } else {
            console.error('登录失败：未获取到有效的用户令牌');
          }
        },
        fail: (error) => {
          console.error('登录请求失败:', error);
        }
      })

    },

    fail: (err) => {
      throw new Error('登录失败：' + err.errMsg);
    }
  })

  // 7. 再次从本地存储中获取 x-user-token
  localToken = wx.getStorageSync('x-user-token');

  // 8. 如果获取到数据，且不为空的情况下，直接返回 x-user-token 的值
  if (localToken && localToken.trim() !== '') {
    return localToken;
  }

  // 9 如果还取不到值则报错
  throw new Error('未获取到有效的用户令牌');
}


/**
 * 构建请求头
 * @param {Object} headers - 用户指定的请求头，可选
 * @param {boolean} tryLogin - 是否尝试登录，默认为false
 * @returns {Object} 最终的请求头对象
 */
function header(headers = {}, tryLogin = false) {
  // 1. 创建 targetHeaders 对象，用于存储最终的请求头
  const targetHeaders = { ...headers };

  // 添加基础应用信息
  targetHeaders['x-app-id'] = xAppId;
  targetHeaders['x-app-chl'] = xAppChl;
  targetHeaders['x-app-chl-appid'] = xAppChlAppid;
  targetHeaders['x-app-chl-app-type'] = xAppChlAppType;

  // 2. 如果 tryLogin === false，获取用户令牌并添加到请求头
  if (!tryLogin) {
    try {
      // 调用 userToken 函数获取用户令牌
      const token = userToken();
      if (token && token.trim() !== '') {
        targetHeaders['x-user-token'] = token;
        targetHeaders['authorization'] = token;
      }
    } catch (error) {
      console.warn('获取用户令牌失败：', error);
    }
  }

  return targetHeaders;
}

/**
 * 通用请求函数
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @param {string} options.method - HTTP方法
 * @param {Object} options.data - 请求数据
 * @param {Object} options.headers - 请求头
 * @param {boolean} options.tryLogin - 是否尝试登录
 * @param {Function} options.pageCallable - 分页回调
 * @param {Function} options.throwCallable - 错误回调
 * @param {Function} options._401AuthCallable - 401回调
 * @param {Function} options._403ForbiddenCallable - 403回调
 * @returns {Promise} Promise对象
 */
function request(uri, options = {}) {
  const {
    method = 'GET',
    data = {},
    headers = {},
    tryLogin = false,
    pageCallable = null,
    throwCallable = null,
    _401AuthCallable = null,
    _403ForbiddenCallable = null,
    _retryCount = 0 // 用于跟踪重试次数，防止无限重试
  } = options;

  const url = uri;
  
  // 构建请求头
  const requestHeaders = header(headers, tryLogin);

  return new Promise((resolve, reject) => {
    wx.request({
      url,
      data,
      header: requestHeaders,
      method,
      success: (res) => {
        // 检查认证状态
        const authSuccess = authenticated(res, _401AuthCallable, _403ForbiddenCallable);
        if (!authSuccess) {
          console.log('认证失败，状态码:', res.statusCode);
          // 401处理逻辑
          if (!tryLogin && res.statusCode === 401 && _retryCount === 0) {
            // 如果tryLogin为false且还未重试过，则尝试刷新token并重试请求
            console.log('认证失败，尝试刷新token...');
            refreshUserToken();
            return request(uri, { 
                ...options, 
                _retryCount: _retryCount + 1 
            });
          } else {
            // 如果已经重试过一次，或者tryLogin为true，则不再重试
            reject(new Error('认证失败'));
          }
          return;
        }

        // 解析响应数据
        const parsedData = parse(res, pageCallable, throwCallable);
        resolve(parsedData);
      },
      fail: (error) => {
        console.error(`请求失败 [${method} ${uri}]:`, error);
        reject(error);
      }
    });
  });
}

/**
 * GET 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function get(uri, options = {}) {
  return request(uri, { ...options, method: 'GET' });
}

/**
 * POST 请求
 * @param {string} uri - API路径
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function post(uri, data = {}, options = {}) {
  return request(uri, { ...options, method: 'POST', data });
}

/**
 * PUT 请求
 * @param {string} uri - API路径
 * @param {Object} data - 请求数据
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function put(uri, data = {}, options = {}) {
  return request(uri, { ...options, method: 'PUT', data });
}

/**
 * DELETE 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function del(uri, options = {}) {
  return request(uri, { ...options, method: 'DELETE' });
}

/**
 * HEAD 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function head(uri, options = {}) {
  return request(uri, { ...options, method: 'HEAD' });
}

/**
 * OPTIONS 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function options(uri, options = {}) {
  return request(uri, { ...options, method: 'OPTIONS' });
}

/**
 * TRACE 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function trace(uri, options = {}) {
  return request(uri, { ...options, method: 'TRACE' });
}

/**
 * CONNECT 请求
 * @param {string} uri - API路径
 * @param {Object} options - 请求选项
 * @returns {Promise} Promise对象
 */
function connect(uri, options = {}) {
  return request(uri, { ...options, method: 'CONNECT' });
}

// 创建REST API对象（默认使用rest类型）
const restApi = {
  request: (uri, options = {}) => request(uri, options),
  get: (uri, options = {}) => get(uri, options),
  post: (uri, data = {}, options = {}) => post(uri, data, options),
  put: (uri, data = {}, options = {}) => put(uri, data, options),
  delete: (uri, options = {}) => del(uri, options),
  head: (uri, options = {}) => head(uri, options),
  options: (uri, options = {}) => options(uri, options),
  trace: (uri, options = {}) => trace(uri, options),
  connect: (uri, options = {}) => connect(uri, options)
};

// 导出函数和REST API对象
module.exports = {
  // 基础方法
  userToken,
  refreshUserToken,
  header,
  request,
  get,
  post,
  put,
  delete: del,
  head,
  options,
  trace,
  connect,
};