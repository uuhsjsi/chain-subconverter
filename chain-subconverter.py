import http.server
import socketserver
import requests
import logging
import logging.handlers
import os
from ruamel.yaml import YAML
from ruamel.yaml.compat import StringIO

# 配置日志
LOG_FILE = "logs/server.log"
LOG_DIR = os.path.dirname(LOG_FILE)
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, maxBytes=1024*1024, backupCount=2, encoding='utf-8'
)
handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(handler)

# 配置，从环境变量读取
PORT = int(os.getenv("PORT", 11200))
REMOTE_URL = os.getenv(
    "REMOTE_URL",
    "<在这里输入你的订阅URL>"
)
MANUAL_DIALER_ENABLED = int(os.getenv("MANUAL_DIALER_ENABLED", 0))
LANDING_NODE_1 = os.getenv("LANDING_NODE_1", "")
DIALER_NODE_1 = os.getenv("DIALER_NODE_1", "")
LANDING_NODE_2 = os.getenv("LANDING_NODE_2", "")
DIALER_NODE_2 = os.getenv("DIALER_NODE_2", "")
MODIFICATIONS = [
    {"keywords": ["Landing", "落地"], "region_keywords": ["HK", "香港"], "dialer_proxy": "🇭🇰 香港节点"},
    {"keywords": ["Landing", "落地"], "region_keywords": ["US", "美国"], "dialer_proxy": "🇺🇸 美国节点"},
    {"keywords": ["Landing", "落地"], "region_keywords": ["JP", "日本"], "dialer_proxy": "🇯🇵 日本节点"},
    {"keywords": ["Landing", "落地"], "region_keywords": ["SG", "新加坡"], "dialer_proxy": "🇸🇬 新加坡节点"},
    {"keywords": ["Landing", "落地"], "region_keywords": ["TW", "台湾"], "dialer_proxy": "🇼🇸 台湾节点"},
    {"keywords": ["Landing", "落地"], "region_keywords": ["KR", "韩国"], "dialer_proxy": "🇰🇷 韩国节点"},
]

# 初始化 ruamel.yaml
yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)  # 修复 proxy-groups 缩进
yaml.width = 1000  # 强制内联单行
yaml.explicit_start = True  # 添加 --- 起始标记

# 打印环境变量
logger.info(f"Environment variables: PORT={PORT}, REMOTE_URL={REMOTE_URL}, "
            f"MANUAL_DIALER_ENABLED={MANUAL_DIALER_ENABLED}, "
            f"LANDING_NODE_1={LANDING_NODE_1}, DIALER_NODE_1={DIALER_NODE_1}, "
            f"LANDING_NODE_2={LANDING_NODE_2}, DIALER_NODE_2={DIALER_NODE_2}")

class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/subscription.yaml":
            try:
                logger.info(f"Requesting data from {REMOTE_URL}")
                response = requests.get(REMOTE_URL, timeout=10)
                logger.info(f"Response status code: {response.status_code}")
                content_type = response.headers.get("Content-Type", "")
                logger.info(f"Response Content-Type: {content_type}")

                # 解析 YAML
                config = yaml.load(response.content)
                if not config or "proxies" not in config or "proxy-groups" not in config:
                    logger.error("Invalid YAML or missing 'proxies'/'proxy-groups' section")
                    raise ValueError("Invalid YAML or missing 'proxies'/'proxy-groups' section")

                landing_nodes = []

                # 手动拨号模式
                if MANUAL_DIALER_ENABLED:
                    logger.info("Using manual dialer mode")
                    manual_configs = [
                        (LANDING_NODE_1, DIALER_NODE_1),
                        (LANDING_NODE_2, DIALER_NODE_2)
                    ]
                    for landing_node, dialer_proxy in manual_configs:
                        if landing_node and dialer_proxy:
                            for proxy in config["proxies"]:
                                if proxy["name"] == landing_node:
                                    proxy["dialer-proxy"] = dialer_proxy
                                    landing_nodes.append((landing_node, dialer_proxy))
                                    logger.info(f"Applied manual dialer-proxy '{dialer_proxy}' for node '{landing_node}'")
                                    break
                            else:
                                logger.warning(f"No match for manual node '{landing_node}'")
                else:
                    # 自动拨号模式
                    logger.info("Using automatic dialer mode")
                    for proxy in config["proxies"]:
                        name = proxy["name"]
                        matched = False
                        for mod in MODIFICATIONS:
                            if (any(kw.lower() in name.lower() for kw in mod["keywords"]) and
                                any(rk.lower() in name.lower() for rk in mod["region_keywords"])):
                                proxy["dialer-proxy"] = mod["dialer_proxy"]
                                landing_nodes.append((name, mod["dialer_proxy"]))
                                logger.info(f"Added dialer-proxy '{mod['dialer_proxy']}' for node '{name}'")
                                matched = True
                                break
                        if not matched and any(kw.lower() in name.lower() for kw in ["Landing", "落地"]):
                            logger.warning(f"No region match for landing node '{name}'")

                # 处理 proxy-groups
                for node_name, group_name in landing_nodes:
                    for group in config["proxy-groups"]:
                        if group["name"] == group_name and "proxies" in group:
                            if node_name in group["proxies"]:
                                group["proxies"].remove(node_name)
                                logger.info(f"Removed node '{node_name}' from group '{group_name}'")
                            else:
                                logger.warning(f"Node '{node_name}' not found in group '{group_name}'")
                        elif group["name"] == group_name:
                            logger.warning(f"No 'proxies' key in group '{group_name}'")

                # 序列化 YAML
                output = StringIO()
                yaml.dump(config, output)
                modified_yaml = output.getvalue()

                # 保存最新 YAML 到日志目录
                yaml_file = os.path.join(LOG_DIR, "subscription_latest.yaml")
                with open(yaml_file, "w", encoding="utf-8") as f:
                    f.write(modified_yaml)
                logger.info(f"Saved latest YAML to {yaml_file}")

                self.send_response(200)
                self.send_header("Content-Type", "text/yaml; charset=utf-8")
                self.end_headers()
                self.wfile.write(modified_yaml.encode("utf-8"))
            except requests.RequestException as e:
                logger.error(f"Request error: {str(e)}")
                self.send_error_response(f"Request error: {str(e)}")
            except ValueError as e:
                logger.error(f"Parse error: {str(e)}")
                self.send_error_response(f"Parse error: {str(e)}")
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}", exc_info=True)
                self.send_error_response(f"Unexpected error: {str(e)}")
        else:
            super().do_GET()

    def send_error_response(self, message):
        self.send_response(500)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

# 启动服务器
with socketserver.TCPServer(("", PORT), CustomHandler) as httpd:
    logger.info(f"Serving at http://0.0.0.0:{PORT}")
    logger.info(f"Access modified subscription at http://<请在此处输入你的服务器IP>:{PORT}/subscription.yaml")
    httpd.serve_forever()