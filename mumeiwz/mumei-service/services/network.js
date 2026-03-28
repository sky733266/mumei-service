const dns = require('dns').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const https = require('https');
const http = require('http');
const { URL } = require('url');

// 网络工具服务
class NetworkService {
  // DNS查询
  static async dnsLookup(domain, type = 'A') {
    const startTime = Date.now();

    try {
      let records;
      
      switch (type.toUpperCase()) {
        case 'A':
          records = await dns.resolve4(domain);
          break;
        case 'AAAA':
          records = await dns.resolve6(domain);
          break;
        case 'MX':
          records = await dns.resolveMx(domain);
          break;
        case 'TXT':
          records = await dns.resolveTxt(domain);
          break;
        case 'NS':
          records = await dns.resolveNs(domain);
          break;
        case 'CNAME':
          records = await dns.resolveCname(domain);
          break;
        case 'SOA':
          records = await dns.resolveSoa(domain);
          break;
        case 'SRV':
          records = await dns.resolveSrv(domain);
          break;
        case 'PTR':
          records = await dns.resolvePtr(domain);
          break;
        case 'CAA':
          records = await dns.resolveCaa(domain);
          break;
        case 'ANY':
        default:
          // 查询所有类型
          const [a, aaaa, mx, txt, ns] = await Promise.allSettled([
            dns.resolve4(domain),
            dns.resolve6(domain),
            dns.resolveMx(domain),
            dns.resolveTxt(domain),
            dns.resolveNs(domain)
          ]);
          records = {
            A: a.status === 'fulfilled' ? a.value : null,
            AAAA: aaaa.status === 'fulfilled' ? aaaa.value : null,
            MX: mx.status === 'fulfilled' ? mx.value : null,
            TXT: txt.status === 'fulfilled' ? txt.value : null,
            NS: ns.status === 'fulfilled' ? ns.value : null
          };
      }

      return {
        success: true,
        domain,
        type: type.toUpperCase(),
        records,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        domain,
        type: type.toUpperCase(),
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // IP查询
  static async ipLookup(ip) {
    const startTime = Date.now();

    try {
      // 验证IP格式
      const isValidIP = this.isValidIP(ip);
      if (!isValidIP) {
        throw new Error('无效的IP地址');
      }

      const isPrivate = this.isPrivateIP(ip);
      const isIPv6 = ip.includes(':');

      // 尝试反向DNS查询
      let reverseDNS = null;
      try {
        reverseDNS = await dns.reverse(ip);
      } catch {
        // 忽略反向查询错误
      }

      // 获取IP类型信息
      const ipInfo = {
        ip,
        type: isIPv6 ? 'IPv6' : 'IPv4',
        version: isIPv6 ? 6 : 4,
        isPrivate,
        isLoopback: ip === '127.0.0.1' || ip === '::1',
        reverseDNS,
        binary: this.ipToBinary(ip),
        integer: this.ipToInteger(ip)
      };

      // 如果是公网IP，尝试获取地理位置（模拟）
      if (!isPrivate) {
        ipInfo.geo = await this.getIPGeo(ip);
      }

      return {
        success: true,
        ...ipInfo,
        duration: Date.now() - startTime
      };
    } catch (error) {
      return {
        success: false,
        ip,
        error: error.message,
        duration: Date.now() - startTime
      };
    }
  }

  // 验证IP格式
  static isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::1$|^::$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  // 检查是否为私有IP
  static isPrivateIP(ip) {
    const privateRanges = [
      /^10\./,
      /^172\.(1[6-9]|2[0-9]|3[01])\./,
      /^192\.168\./,
      /^127\./,
      /^169\.254\./,
      /^::1$/,
      /^fc00:/i,
      /^fe80:/i
    ];
    return privateRanges.some(range => range.test(ip));
  }

  // IP转二进制
  static ipToBinary(ip) {
    if (ip.includes(':')) {
      // IPv6
      const parts = ip.split(':');
      return parts.map(p => parseInt(p || '0', 16).toString(2).padStart(16, '0')).join(':');
    } else {
      // IPv4
      return ip.split('.').map(octet => parseInt(octet).toString(2).padStart(8, '0')).join('.');
    }
  }

  // IP转整数
  static ipToInteger(ip) {
    if (ip.includes(':')) return null; // IPv6太大
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet), 0) >>> 0;
  }

  // 获取IP地理位置（模拟）
  static async getIPGeo(ip) {
    // 实际项目中可以使用 ip-api.com, ipinfo.io 等服务
    // 这里返回模拟数据
    return {
      country: 'CN',
      countryName: 'China',
      region: 'Beijing',
      city: 'Beijing',
      latitude: 39.9042,
      longitude: 116.4074,
      timezone: 'Asia/Shanghai',
      isp: 'China Telecom',
      note: '模拟数据，实际使用需接入IP地理位置API'
    };
  }

  // Whois查询
  static async whoisLookup(domain) {
    const startTime = Date.now();

    try {
      // 使用whois命令
      const { stdout } = await execPromise(`whois "${domain}"`, { timeout: 30000 });
      
      // 解析Whois信息
      const info = this.parseWhois(stdout);

      return {
        success: true,
        domain,
        raw: stdout,
        parsed: info,
        duration: Date.now() - startTime
      };
    } catch (error) {
      // 如果whois命令失败，返回模拟数据
      return {
        success: true,
        domain,
        raw: null,
        parsed: this.getMockWhois(domain),
        note: 'whois命令不可用，返回模拟数据',
        duration: Date.now() - startTime
      };
    }
  }

  // 解析Whois输出
  static parseWhois(whoisText) {
    const info = {};
    const lines = whoisText.split('\n');
    
    for (const line of lines) {
      const match = line.match(/^([^:]+):\s*(.+)$/);
      if (match) {
        const key = match[1].trim().toLowerCase().replace(/\s+/g, '_');
        const value = match[2].trim();
        if (info[key]) {
          if (Array.isArray(info[key])) {
            info[key].push(value);
          } else {
            info[key] = [info[key], value];
          }
        } else {
          info[key] = value;
        }
      }
    }

    return info;
  }

  // 模拟Whois数据
  static getMockWhois(domain) {
    const now = new Date();
    const exp = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    
    return {
      domain_name: domain.toUpperCase(),
      registrar: 'Example Registrar, LLC',
      creation_date: now.toISOString(),
      expiration_date: exp.toISOString(),
      name_server: ['ns1.example.com', 'ns2.example.com'],
      status: 'clientTransferProhibited',
      dnssec: 'unsigned'
    };
  }

  // SSL证书检查
  static async checkSSL(hostname, port = 443) {
    const startTime = Date.now();

    return new Promise((resolve) => {
      const options = {
        hostname,
        port,
        method: 'GET',
        rejectUnauthorized: false
      };

      const req = https.request(options, (res) => {
        const cert = res.socket.getPeerCertificate();
        
        if (!cert || Object.keys(cert).length === 0) {
          resolve({
            success: false,
            hostname,
            port,
            error: '无法获取SSL证书',
            duration: Date.now() - startTime
          });
          return;
        }

        const now = new Date();
        const validFrom = new Date(cert.valid_from);
        const validTo = new Date(cert.valid_to);
        const daysUntilExpiry = Math.floor((validTo - now) / (1000 * 60 * 60 * 24));

        resolve({
          success: true,
          hostname,
          port,
          subject: cert.subject,
          issuer: cert.issuer,
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          daysUntilExpiry,
          expired: daysUntilExpiry < 0,
          fingerprint: cert.fingerprint,
          serialNumber: cert.serialNumber,
          protocol: res.socket.getProtocol(),
          cipher: res.socket.getCipher(),
          duration: Date.now() - startTime
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          hostname,
          port,
          error: error.message,
          duration: Date.now() - startTime
        });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({
          success: false,
          hostname,
          port,
          error: '连接超时',
          duration: Date.now() - startTime
        });
      });

      req.end();
    });
  }

  // 网站测速
  static async speedTest(url, options = {}) {
    const startTime = Date.now();
    const results = {
      url,
      timings: {},
      redirects: [],
      headers: null,
      statusCode: null,
      size: 0
    };

    const maxRedirects = options.maxRedirects || 5;
    let currentUrl = url;
    let redirectCount = 0;

    return new Promise((resolve) => {
      const makeRequest = (targetUrl) => {
        const urlObj = new URL(targetUrl);
        const protocol = urlObj.protocol === 'https:' ? https : http;
        
        const timingStart = Date.now();
        
        const req = protocol.request(targetUrl, {
          method: 'GET',
          timeout: options.timeout || 30000,
          headers: {
            'User-Agent': 'Mumei-Service-SpeedTest/1.0'
          }
        }, (res) => {
          const dnsTime = timingStart - startTime;
          const connectTime = Date.now() - timingStart;
          
          // 处理重定向
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectCount < maxRedirects) {
              redirectCount++;
              results.redirects.push({
                from: currentUrl,
                to: res.headers.location,
                statusCode: res.statusCode
              });
              currentUrl = new URL(res.headers.location, currentUrl).toString();
              makeRequest(currentUrl);
              return;
            }
          }

          let data = '';
          const firstByteTime = Date.now();
          
          res.on('data', (chunk) => {
            data += chunk;
          });

          res.on('end', () => {
            const totalTime = Date.now() - startTime;
            
            results.statusCode = res.statusCode;
            results.headers = res.headers;
            results.size = Buffer.byteLength(data);
            results.timings = {
              dns: dnsTime,
              connect: connectTime,
              firstByte: firstByteTime - timingStart,
              download: Date.now() - firstByteTime,
              total: totalTime
            };

            resolve({
              success: res.statusCode >= 200 && res.statusCode < 400,
              ...results,
              duration: totalTime
            });
          });
        });

        req.on('error', (error) => {
          resolve({
            success: false,
            ...results,
            error: error.message,
            duration: Date.now() - startTime
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            success: false,
            ...results,
            error: '请求超时',
            duration: Date.now() - startTime
          });
        });

        req.end();
      };

      makeRequest(currentUrl);
    });
  }

  // HTTP请求测试（类似Postman）
  static async httpRequest(options) {
    const startTime = Date.now();
    
    const {
      url,
      method = 'GET',
      headers = {},
      body = null,
      timeout = 30000,
      followRedirects = true
    } = options;

    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const protocol = urlObj.protocol === 'https:' ? https : http;

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method.toUpperCase(),
        headers: {
          'User-Agent': 'Mumei-Service-HTTPClient/1.0',
          ...headers
        },
        timeout
      };

      const req = protocol.request(requestOptions, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          let parsedBody = data;
          
          // 尝试解析JSON
          try {
            parsedBody = JSON.parse(data);
          } catch {
            // 保持原始字符串
          }

          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: parsedBody,
            rawBody: data,
            size: Buffer.byteLength(data),
            duration: Date.now() - startTime
          });
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: error.message,
          duration: Date.now() - startTime
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: '请求超时',
          duration: Date.now() - startTime
        });
      });

      if (body) {
        const bodyData = typeof body === 'string' ? body : JSON.stringify(body);
        req.write(bodyData);
      }

      req.end();
    });
  }
}

module.exports = {
  NetworkService
};
