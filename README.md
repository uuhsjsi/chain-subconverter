# chain-subconverter

[![Docker Pulls](https://img.shields.io/docker/pulls/slackworker/chain-subconverter.svg)](https://github.com/slackworker/chain-subconverter/pkgs/container/chain-subconverter)
[![GitHub Stars](https://img.shields.io/github/stars/slackworker/chain-subconverter.svg?style=social&label=Star&maxAge=2592000)](https://github.com/slackworker/chain-subconverter/stargazers/)
**Mihomo 链式代理 · 订阅转换器**

一个为 [Mihomo (Clash Meta 内核)](https://wiki.metacubex.one/) 设计的、支持链式代理 (`dialer-proxy`) 配置的订阅转换工具。它提供了一个易于部署的后端服务和直观的前端配置界面。

---

## 🤔 项目解决了什么问题？

Mihomo 内核拥有强大的代理和分流功能，但市面上许多常用的订阅转换服务并不支持其 `dialer-proxy`（链式代理）字段的配置，甚至会将其过滤。 这使得需要使用链式代理并希望保持订阅自动更新的用户，不得不频繁手动编辑 YAML 配置文件，过程繁琐且易出错。

`chain-subconverter` 正是为了解决这一痛点而生，让链式代理的配置和订阅更新变得简单高效。

## ✨ 项目特性

* **🐳 一键 Docker 部署**：提供 Docker 镜像，快速启动后端服务及内建前端。
* **🖥️ 易用 Web 前端**：通过图形化界面轻松配置链式代理规则。
* **🤖 智能节点识别**：支持自动识别原始订阅中的落地节点并尝试匹配前置节点/组。
* **✍️ 灵活手动配置**：允许用户精确手动指定落地节点与前置节点/组的配对。
* **🔄 动态应用配置**：生成的订阅链接在每次被客户端请求时，都会将链式规则动态应用于最新的原始订阅内容。
* **🎯 专为 `dialer-proxy` 设计**：核心功能是为 Mihomo 的 `dialer-proxy` 提供便捷的配置方案。

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

上述命令将在后台启动服务，并将您服务器的 11200 端口映射到容器。您可以修改 -p 参数的第一个 11200 来更改宿主机端口。默认情况下，日志级别为 INFO，SSL 验证为 true。

➡️ 详细部署步骤、参数说明及更新指南，请参阅：GitHub Wiki - 部署指南
(请将 YOUR_USERNAME/YOUR_REPOSITORY 替换为您的实际GitHub用户名和仓库名)

### 2. 使用前端配置订阅

1.  **访问前端**：部署成功后，在浏览器中打开 `http://<运行Docker设备的IP或域名>:<映射的宿主机端口>/`。
2.  **输入原始订阅**：粘贴您的有效 Mihomo/Clash Meta 订阅链接。
3.  **配置节点对**：通过“自动识别”或“手动添加”功能，指定落地节点及其对应的前置节点/组。
4.  **生成链接**：点击“生成”按钮，获取包含链式代理配置的新订阅链接，并用于您的客户端。

➡️ **完整使用教程、界面说明及节点命名建议，请参阅：[GitHub Wiki - 快速上手与使用教程](https://github.com/slackworker/chain-subconverter/wiki)**

## 🔗 相关链接

* **[📖 项目 Wiki 文档](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/wiki)**：获取所有详细指南、配置说明和常见问题解答。
* **[📜 版本发布历史](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/releases)**：查看所有版本的更新内容。
* **[🐛 问题反馈 / ✨ 功能建议](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/issues)**：遇到问题或有新想法？欢迎提出！
* **Mihomo `dialer-proxy` 参考**：[https://wiki.metacubex.one/config/proxies/dialer-proxy/](https://wiki.metacubex.one/config/proxies/dialer-proxy/)

## 🚧 未来计划 (Todo List)

* 持续优化自动节点识别算法和内置关键字库。
* (可能) 使用 JavaScript 重构整个项目以实现更灵活的部署方式。 [cite: 1]
* 探索支持更多高级链式配置场景。
* UI/UX 持续改进。

➡️ **更详细的未来计划，请参阅：[GitHub Wiki - 未来计划 (Todo List)](https://github.com/YOUR_USERNAME/YOUR_REPOSITORY/wiki/TODO)** (假设您会创建此页面)

## 🤝 贡献

欢迎各种形式的贡献，包括但不限于：

* 提交 Bug 报告和功能建议。
* 完善文档。
* 提交代码 (Pull Requests)。

在提交代码前，请先阅读贡献指南 (如果项目未来提供 `CONTRIBUTING.md`)。

## 📜 许可证

本项目基于 **MIT 许可证** 发布。 [cite: 1] 详情请参阅 `LICENSE` 文件。