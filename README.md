# chain-subconverter

[![GHCR](https://img.shields.io/badge/GHCR-chain--subconverter-blue?logo=github)](https://github.com/slackworker/chain-subconverter/pkgs/container/chain-subconverter)
[![GitHub Stars](https://img.shields.io/github/stars/slackworker/chain-subconverter.svg?style=social&label=Star&maxAge=2592000)](https://github.com/slackworker/chain-subconverter/stargazers/)

**链式代理 · 订阅转换器 for Mihomo**

一个为 [Mihomo(Clash Meta) 内核](https://wiki.metacubex.one/) 设计的、用于链式代理 (`dialer-proxy`) 配置的订阅转换工具。它包含一个Python后端服务和直观的前端配置界面。

---

## 🤔 项目解决了什么问题？

Mihomo 内核拥有强大的代理和分流功能，但市面上常用的订阅转换服务并不支持其 `dialer-proxy`（链式代理）字段的配置，并且会将其过滤。 这使得需要使用链式代理并希望保持订阅自动更新的用户，不得不频繁手动编辑 YAML 配置文件，过程繁琐且易出错。

`chain-subconverter` 为解决这一痛点而生，让链式代理的配置和订阅更新变得简单高效。

## ✨ 项目特性

* **🐳 一键 Docker 部署**：提供 Docker 镜像，快速启动后端服务及内建前端。
* **🖥️ 易用 Web 前端**：通过图形化界面轻松配置链式代理规则。
* **🤖 智能节点识别**：支持自动识别原始订阅中的落地节点并尝试匹配前置节点/组。
* **✍️ 灵活手动配置**：允许用户精确手动指定落地节点与前置节点/组的配对。
* **🔄 动态应用配置**：生成的订阅链接在每次被客户端请求时，都会将链式规则动态应用于最新的原始订阅内容。
## ✨ 尝鲜预览

您可以通过以下链接在线预览和体验本项目：

[➡️ 点击这里进行在线预览](https://chain-subconverter-latest.onrender.com/)

**⚠️ 重要提醒：**
* 以上仅供项目预览，不保证服务的稳定性。
* 本项目完全开源，设计上不记录任何用户敏感信息。
* **信别人不如信自己**，我们强烈建议每个人自行部署服务使用。[《部署指南》](Deployment-Guide.md)

---
## 🚀 快速开始

### 1. 部署 Docker 后端服务

在您的服务器或支持 Docker 的设备上执行以下命令：

```bash
docker run -d \
  --name chain-subconverter \
  -p 11200:11200 \
  --restart unless-stopped \
  ghcr.io/slackworker/chain-subconverter:latest
```

上述命令将在后台启动服务，并将您服务器的 11200 端口映射到容器。您可以修改 -p 参数的第一个 11200 来更改宿主机端口。默认情况下，日志级别为 INFO，SSL 验证为 true，自定义服务根地址为 false。

➡️ **详细部署步骤、参数说明及更新指南，请参阅：[GitHub Wiki - 部署指南](https://github.com/slackworker/chain-subconverter/wiki/Deployment-Guide)**

### 2. 使用前端配置订阅

1.  **访问前端**：部署成功后，在浏览器中打开 `http://<运行Docker设备的IP或域名>:<映射的宿主机端口>/`。
2.  **输入原始订阅**：粘贴您的有效 Mihomo/Clash Meta 订阅链接。
3.  **配置节点对**：通过“自动识别”或“手动添加”功能，指定落地节点及其对应的前置节点/组。
4.  **生成链接**：点击“生成”按钮，验证并生成包含链式代理配置的新订阅链接，并用于您的客户端。

➡️ **完整使用教程、界面说明及节点命名建议，请参阅：[GitHub Wiki - 快速上手与使用教程](https://github.com/slackworker/chain-subconverter/wiki)**

## 🔗 相关链接

* **[📖 项目 Wiki 文档](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/wiki)**：获取所有详细指南、配置说明和常见问题解答。
* **[📜 版本发布历史](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/releases)**：查看所有版本的更新内容。
* **[🐛 问题反馈 / ✨ 功能建议](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/issues)**：遇到问题或有新想法？欢迎提出！
* **Mihomo `dialer-proxy` 参考**：[https://wiki.metacubex.one/config/proxies/dialer-proxy/](https://wiki.metacubex.one/config/proxies/dialer-proxy/)

## 🚧 未来计划 (Todo List)

* 补充优化自动节点规则。
* (可能) 使用 JavaScript 重构整个项目以实现更灵活的部署方式。
* 探索支持更多内核的链式配置功能。
* UI/UX 持续改进。

<!-- ➡️ **更详细的未来计划，请参阅：[GitHub Wiki - 未来计划 (Todo List)](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/wiki/TODO)**  -->

## 🤝 贡献

欢迎各种形式的贡献，包括但不限于：

* 提交 Bug 报告和功能建议。
* 完善文档。
* 提交代码 (Pull Requests)。

<!-- 在提交代码前，请先阅读贡献指南 (如果项目未来提供 `CONTRIBUTING.md`)。 -->

## 📜 许可证

本项目基于 **MIT 许可证** 发布。