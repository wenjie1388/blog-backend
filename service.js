const Service = require('node-windows').Service;
const path = require('path');

// 创建服务
const svc = new Service({
  name: 'Blog Backend API',
  description: '个人博客后端API服务',
  script: path.join(__dirname, 'src', 'app.js'),
  nodeOptions: [
    '--harmony',
    '--max_old_space_size=4096'
  ],
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
});

// 监听安装事件
svc.on('install', function() {
  console.log('服务安装成功！');
  console.log('正在启动服务...');
  svc.start();
});

// 监听启动事件
svc.on('start', function() {
  console.log('服务已启动！');
});

// 监听停止事件
svc.on('stop', function() {
  console.log('服务已停止！');
});

// 监听卸载事件
svc.on('uninstall', function() {
  console.log('服务卸载成功！');
});

// 根据命令行参数执行操作
const command = process.argv[2];

switch (command) {
  case 'install':
    console.log('正在安装服务...');
    svc.install();
    break;
  case 'uninstall':
    console.log('正在卸载服务...');
    svc.uninstall();
    break;
  case 'start':
    console.log('正在启动服务...');
    svc.start();
    break;
  case 'stop':
    console.log('正在停止服务...');
    svc.stop();
    break;
  case 'restart':
    console.log('正在重启服务...');
    svc.stop();
    setTimeout(() => svc.start(), 3000);
    break;
  default:
    console.log('用法: node service.js [install|uninstall|start|stop|restart]');
    console.log('  install   - 安装并启动服务');
    console.log('  uninstall - 卸载服务');
    console.log('  start     - 启动服务');
    console.log('  stop      - 停止服务');
    console.log('  restart   - 重启服务');
}
