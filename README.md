# chain-subconverter

A sub-converter for OpenClash/Mihomo chain-proxy configuration.

-----

## 💡 项目简介

Mihomo（原Clash）内核拥有强大的分流功能和成熟的生态系统。我们可以通过订阅他人维护的规则模板来实现高精度的分流，同时保持低维护成本。

然而，市面上常用的订阅转换工具普遍**不支持链式代理的配置**，并且会过滤掉 `dialer-proxy` 字段。这意味着，如果你想定期更新订阅配置，同时又需要使用链式代理功能，常常需要手搓 YAML 文件，非常麻烦。

**`chain-subconverter` 项目正是为解决这个问题而生！**

它提供了一个**一键 Docker 部署**的解决方案，能够自动处理 YAML 订阅文件。每次订阅更新时，它都能**自动为你的落地节点添加前置代理节点/代理组**，确保你的链式代理配置始终有效。

  * **Mihomo `dialer-proxy` 特性参考文档：** [https://wiki.metacubex.one/config/proxies/dialer-proxy/](https://wiki.metacubex.one/config/proxies/dialer-proxy/)
  * **推荐规则模板**（搭配自动模式使用）： [https://github.com/Aethersailor/Custom\_OpenClash\_Rules](https://github.com/Aethersailor/Custom_OpenClash_Rules)

-----

## 🚀 部署 Docker 服务 

部署 `chain-subconverter` 服务非常简单，只需一条 Docker 命令。

**在部署前，你需要准备：**

1.  **已安装 Docker 且能被订阅端访问的设备。**可以是 内网 OpenWrt路由器 NAS 或者 公网VPS。
2.  **一个有效的原OpenClash/Mihomo订阅链接。** 这个链接通常是你使用订阅转换工具合并多条订阅后输出的链接，它必须包含了你的前置和落地节点。如使用OpenClash，点击一次 配置订阅 ➡ 更新，然后在 运行日志 ➡ 插件日志 中找到这条订阅URL。
3.  **确定你的落地节点和前置节点/组名称。**

### 方式一：自动模式 

自动模式下，程序会根据节点名称中的关键字自动匹配并添加 `dialer-proxy`，支持HK/TW/JP/KR/SG/US。

**要求：**

  * **落地节点名称**需要包含 `Landing` 或 `落地` 关键字，同时包含**区域信息**（例如 `HK` 或 `香港`）。
  * **前置策略组/代理组名称**（作为 `dialer-proxy` 的目标）需要包含对应的区域信息（例如 `🇭🇰 香港节点`）。
  * **建议搭配** [推荐规则模板](https://github.com/Aethersailor/Custom_OpenClash_Rules) 使用，精准分流同时确保策略组/代理组的命名规范。如使用OpenClash，自定义规则走 复写设置 ➡ 规则设置 ➡ 自定义规则 或 规则附加 ➡ 自定义规则集附加

**命令示例：**

```bash
docker run -d \
  --name chain-subconverter \
  -p 11200:11200 \
  -e REMOTE_URL="<在这里粘贴你的合并订阅URL，例如：http://<IP/域名>/sub?token=abc>" \
  -e PORT="11200" \
  -e MANUAL_DIALER_ENABLED="0" \
  --restart unless-stopped \
  ghcr.io/slackworker/chain-subconverter:latest
```

### 方式二：手动模式

如果你想精确控制哪个落地节点使用哪个前置代理节点/组，可以使用手动模式。

**命令示例：**

```bash
docker run -d \
  --name chain-subconverter \
  -p 11200:11200 \
  -e REMOTE_URL="<在这里粘贴你的合并订阅URL，例如：http://<IP/域名>/sub?token=abc>" \
  -e PORT="11200" \
  -e MANUAL_DIALER_ENABLED="1" \
  -e LANDING_NODE_1="<在这里粘贴你的落地节点1名称，例如：ss 新加坡 落地>" \
  -e DIALER_NODE_1="<在这里粘贴你的前置代理组1名称，例如：新加坡 01>" \
  -e LANDING_NODE_2="<在这里粘贴你的落地节点2名称，例如：美国-落地节点>" \
  -e DIALER_NODE_2="<在这里粘贴你的前置代理组2名称，例如：🇺🇸 美国 01>" \
  --restart unless-stopped \
  ghcr.io/slackworker/chain-subconverter:latest
```

-----

### 命令说明 (如果不习惯命令行，也可以通过OpenWrt LuCI GUI或其他图形界面来配置)

  * `docker run -d`: 在后台运行容器。
  * `--name chain-subconverter`: 给容器指定一个易于识别的名称。
  * `-p 11200:11200`: 将容器内部的 `11200` 端口映射到 OpenWrt 设备上的 `11200` 端口。你可以修改前面的主机端口 (`11200`) 为其他空闲端口。
  * `-e ...`: 设置环境变量，这是配置程序运行参数的关键。
      * `REMOTE_URL`: **必填**，你的**原订阅链接**。
      * `PORT`: 程序监听的端口，默认是 `11200`。
      * `MANUAL_DIALER_ENABLED`: `0` 表示自动模式，`1` 表示手动模式。
      * `LANDING_NODE_x` / `DIALER_NODE_x`: 仅在手动模式下使用，用于指定落地节点名称和对应的前置代理/组名称。
  * `--restart unless-stopped`: 设置容器重启策略，除非你手动停止它，否则它会在设备重启或容器异常退出时自动启动。
  * `ghcr.io/slackworker/chain-subconverter:latest`: 这是你将要运行的 Docker 镜像。
  * `运行命令`: 镜像内置 CMD，如提示缺少，可填 python chain-subconverter.py 
-----

### 部署步骤：

1.  **复制并粘贴配置好的 `docker run` 命令**到你的设备 终端/控制台，然后执行。部分终端不支持 \（换行反斜杠），则粘贴时必须删除 \（换行反斜杠）不换行（全部合并为一行）。
2.  **检查容器是否启动：**
    在终端输入 `docker ps`。如果看到 `chain-subconverter` 容器的状态是 `Up`，就说明启动成功了！

-----

## ✨ 测试与使用

容器成功启动后，`chain-subconverter` 服务就已经运行起来了！

1.  **访问修改后的订阅链接：**
    在你的浏览器中，使用以下 URL 作为你的新订阅链接：

    ```
    http://<运行Docker设备的IP或域名>:11200/subscription.yaml
    ```

    如果你部署在带 docker 的 OpenWrt 软路由上， IP 为 `192.168.1.1`，则新订阅链接为：
    `http://192.168.1.1:11200/subscription.yaml`

2.  **对比原始订阅：**
    你可以在浏览器中分别访问你的 `REMOTE_URL` (原始订阅) 和 `http://<运行Docker设备的IP或域名>:11200/subscription.yaml` (修改后订阅)，对比两者的内容。
    你会发现修改后的订阅中，被处理的落地节点多了 `dialer-proxy` 字段，同时这些落地节点也从原有的代理组中被移除了（这是自动模式下的特性，防止节点尝试通过自身节点拨号，形成递归）。

3.  **配置客户端：**
    将 `http://<运行Docker设备的IP或域名>:11200/subscription.yaml` 这个链接粘贴到你的 OpenClash/Mihomo 客户端作为**订阅地址**。
    这样，你的客户端就可以使用处理后的链式代理订阅，并且在每次更新订阅后，链式代理 `dialer-proxy` 特性也将被保留，无需手动处理。

-----

## 📜 许可证

本项目基于 MIT 许可证发布。

-----