# 使用一个轻量级的 Python 官方镜像作为基础
FROM python:3.11-slim

# 设置工作目录
WORKDIR /app

# 安装 Python 依赖
# 首先复制 requirements.txt (如果单独管理依赖) 或直接安装
# 这里我们直接安装脚本中导入的库
RUN pip install --no-cache-dir requests ruamel.yaml

# 复制 Python 脚本到工作目录
COPY chain-subconverter.py ./

# 设置默认环境变量 (这些可以在 docker run 命令中覆盖)
ENV PORT=11200
# 请将下面的 REMOTE_URL 替换为您实际要使用的默认远程订阅链接
ENV REMOTE_URL="<在这里输入你的订阅URL>"
ENV MANUAL_DIALER_ENABLED=0
ENV LANDING_NODE_1=""
ENV DIALER_NODE_1=""
ENV LANDING_NODE_2=""
ENV DIALER_NODE_2=""

# 暴露脚本监听的端口
EXPOSE 11200

# 容器启动时运行的命令
CMD ["python", "chain-subconverter.py"]