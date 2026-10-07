import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// 本地面板：不注册 Service Worker、不做前端缓存（旧 SW 由 public/sw.js 退役脚本自愈清除）
// HeroUI v3：无需 Provider（组件自带 context/RAC 架构，样式由 styles.css @import "@heroui/styles" 挂载）
