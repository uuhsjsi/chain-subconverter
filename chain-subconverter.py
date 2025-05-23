import http.server
import requests
import logging
import logging.handlers
import os
import re
from ruamel.yaml import YAML
from ruamel.yaml.compat import StringIO
from http.server import ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs, unquote
import mimetypes # 导入 mimetypes 模块

# --- 配置日志开始 ---
# (日志配置部分保持不变)
LOG_FILE = "logs/server.log"
LOG_DIR = os.path.dirname(LOG_FILE)
if not os.path.exists(LOG_DIR):
    os.makedirs(LOG_DIR)

logger = logging.getLogger(__name__)
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logger.setLevel(LOG_LEVEL)

file_handler = logging.handlers.RotatingFileHandler(
    LOG_FILE, maxBytes=1024*1024, backupCount=2, encoding='utf-8'
)
file_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(file_handler)

console_handler = logging.StreamHandler()
console_handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
logger.addHandler(console_handler)
# --- 配置日志结束 ---

# --- 全局配置 ---
# (全局配置部分保持不变)
PORT = int(os.getenv("PORT", 11200))
REGION_MAPPING = [
    {"region_node_keywords": ["HK", "HongKong", "Hong Kong", "香港"],
     "identifier_patterns": [r"\bhk\b", r"hong\s*kong", r"香港"]},
    {"region_node_keywords": ["US", "UnitedStates", "United States", "美国"],
     "identifier_patterns": [r"\bus\b", r"united\s*states", r"america", r"美国"]},
    {"region_node_keywords": ["JP", "Japan", "日本"],
     "identifier_patterns": [r"\bjp\b", r"japan", r"日本"]},
    {"region_node_keywords": ["SG", "Singapore", "新加坡"],
     "identifier_patterns": [r"\bsg\b", r"singapore", r"新加坡"]},
    {"region_node_keywords": ["TW", "Taiwan", "台湾"],
     "identifier_patterns": [r"\btw\b", r"taiwan", r"台湾"]},
    {"region_node_keywords": ["KR", "Korea", "韩国"],
     "identifier_patterns": [r"\bkr\b", r"korea", r"韩国"]},
]
LANDING_NODE_KEYWORDS = ["Landing", "落地"]

yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.width = float('inf')
yaml.explicit_start = True
# --- 全局配置结束 ---

# --- process_subscription 和 find_matching_dialer_group 函数保持不变 ---
def find_matching_dialer_group(node_name, all_proxy_groups, current_logger):
    node_name_lower = node_name.lower()
    best_match_group = None
    highest_score = -1
    identified_region_patterns_for_search = None

    for region_info in REGION_MAPPING:
        if any(kw.lower() in node_name_lower for kw in region_info["region_node_keywords"]):
            identified_region_patterns_for_search = region_info["identifier_patterns"]
            current_logger.info(f"Node '{node_name}' identified with region. Will search groups using patterns: {identified_region_patterns_for_search}")
            break

    if not identified_region_patterns_for_search:
        current_logger.warning(f"No region identified in landing node name: '{node_name}' based on region_node_keywords.")
        return None

    current_logger.info(f"Attempting to find dialer group for node '{node_name}' using region patterns: {identified_region_patterns_for_search}")
    for group in all_proxy_groups:
        group_name = group.get("name", "")
        group_name_lower = group_name.lower()

        if not (group_name and group.get("type")):
            continue

        current_score_for_this_group = 0
        match_details = []
        for pattern in identified_region_patterns_for_search:
            try:
                if re.search(pattern, group_name_lower, re.IGNORECASE):
                    score_for_this_pattern = len(pattern)
                    if pattern.startswith(r"\b") and pattern.endswith(r"\b"):
                        score_for_this_pattern += 10
                    current_score_for_this_group += score_for_this_pattern
                    match_details.append(pattern)
            except re.error as e:
                current_logger.error(f"Regex error with pattern '{pattern}' while searching in group '{group_name}': {e}")
                continue

        if current_score_for_this_group > 0:
            current_logger.debug(f"Group '{group_name}' (score: {current_score_for_this_group}) matched patterns: {match_details} for node '{node_name}'.")
            if current_score_for_this_group > highest_score:
                highest_score = current_score_for_this_group
                best_match_group = group
                current_logger.info(f"New best match for node '{node_name}': group '{group_name}' with score {highest_score}.")
            elif current_score_for_this_group == highest_score and best_match_group:
                if len(group_name) < len(best_match_group.get("name", "")):
                    current_logger.debug(f"Group '{group_name}' has same score but shorter name than '{best_match_group.get('name')}'. Updating best match.")
                    best_match_group = group
                else:
                    current_logger.debug(f"Group '{group_name}' has same score as current best '{best_match_group.get('name')}'. Keeping current best.")

    if best_match_group:
        current_logger.info(f"Final best matching dialer group for node '{node_name}' is '{best_match_group['name']}' with score {highest_score}.")
    else:
        current_logger.warning(f"No dialer group found for node '{node_name}' that matches its identified region patterns.")

    return best_match_group


def process_subscription(remote_url, manual_dialer_enabled, manual_pairs_list, current_logger):
    current_logger.info(f"Processing subscription for REMOTE_URL: {remote_url}")
    current_logger.info(f"Manual dialer enabled (0=auto, 1=manual): {manual_dialer_enabled}")
    if int(manual_dialer_enabled) == 1:
        current_logger.info(f"Manual pairs (LandingFromUI:FrontFromUI): {manual_pairs_list}")

    try:
        response = requests.get(remote_url, timeout=15)
        response.raise_for_status()
        current_logger.info(f"Response status code from remote: {response.status_code}")
    except requests.Timeout:
        current_logger.error(f"Request to remote_url '{remote_url}' timed out.")
        raise
    except requests.RequestException as e:
        current_logger.error(f"Request error for remote_url '{remote_url}': {e}")
        raise

    try:
        config_content = response.content
        if config_content.startswith(b'\xef\xbb\xbf'):
            current_logger.info("UTF-8 BOM detected and removed from remote content.")
            config_content = config_content[3:]
        config = yaml.load(config_content)

        if not isinstance(config, dict) or "proxies" not in config or "proxy-groups" not in config:
            current_logger.error("Invalid YAML from remote or missing 'proxies'/'proxy-groups' section")
            raise ValueError("Invalid YAML from remote or missing 'proxies'/'proxy-groups' section")
    except Exception as e:
        current_logger.error(f"Error parsing YAML from remote_url '{remote_url}': {e}", exc_info=True)
        raise ValueError(f"Error parsing YAML from remote: {e}")

    proxies = config.get("proxies", [])
    proxy_groups = config.get("proxy-groups", [])

    if int(manual_dialer_enabled) == 1:
        current_logger.info("Using manual dialer mode.")
        if not manual_pairs_list:
            current_logger.warning("Manual dialer mode selected, but no valid manual_pairs provided.")

        for landing_name_ui, front_name_ui in manual_pairs_list:
            found_landing_node_for_manual_config = False
            for proxy_node in proxies:
                if proxy_node.get("name") == landing_name_ui:
                    proxy_node["dialer-proxy"] = front_name_ui
                    current_logger.info(f"Applied manual dialer-proxy '{front_name_ui}' TO landing node '{landing_name_ui}'")
                    found_landing_node_for_manual_config = True

                    target_dialer_group_obj = None
                    for grp in proxy_groups:
                        if grp.get("name") == front_name_ui:
                            target_dialer_group_obj = grp
                            break

                    if target_dialer_group_obj:
                        group_proxies_list = target_dialer_group_obj.get("proxies")
                        if isinstance(group_proxies_list, list):
                            if landing_name_ui in group_proxies_list:
                                try:
                                    group_proxies_list.remove(landing_name_ui)
                                    current_logger.info(f"Removed landing node '{landing_name_ui}' from proxy list of its dialer group '{front_name_ui}' to prevent recursion.")
                                except ValueError:
                                    current_logger.warning(f"Landing node '{landing_name_ui}' reported in dialer group '{front_name_ui}' but remove failed.")
                        else:
                            current_logger.warning(f"Dialer group '{front_name_ui}' for landing node '{landing_name_ui}' does not have a valid 'proxies' list.")
                    else:
                        current_logger.info(f"Dialer target '{front_name_ui}' for landing node '{landing_name_ui}' is not a proxy group (or not found). No group-based removal check needed.")
                    break
            if not found_landing_node_for_manual_config:
                current_logger.warning(f"Manual mode: Landing node '{landing_name_ui}' (from UI left column) not found in proxies list.")

    else: # Automatic mode (manual_dialer_enabled == 0)
        current_logger.info("Using automatic dialer mode")
        for proxy_idx, proxy_node in enumerate(proxies):
            proxy_name = proxy_node.get("name", "")
            proxy_name_lower = proxy_name.lower()

            is_landing_node_type = any(kw.lower() in proxy_name_lower for kw in LANDING_NODE_KEYWORDS)
            if not is_landing_node_type:
                continue

            current_logger.info(f"Processing potential landing node (idx: {proxy_idx}): '{proxy_name}' for auto dialing.")
            dialer_proxy_group_obj = find_matching_dialer_group(proxy_name, proxy_groups, current_logger)

            if dialer_proxy_group_obj and dialer_proxy_group_obj.get("name"):
                dialer_proxy_group_name = dialer_proxy_group_obj["name"]
                proxy_node["dialer-proxy"] = dialer_proxy_group_name
                current_logger.info(f"Applied auto dialer-proxy '{dialer_proxy_group_name}' for landing node '{proxy_name}'")

                group_proxies_list = dialer_proxy_group_obj.get("proxies")
                if isinstance(group_proxies_list, list):
                    if proxy_name in group_proxies_list:
                        try:
                            group_proxies_list.remove(proxy_name)
                            current_logger.info(f"Removed landing node '{proxy_name}' from its dialer group '{dialer_proxy_group_name}' proxies list.")
                        except ValueError:
                            current_logger.warning(f"Node '{proxy_name}' was reported in group '{dialer_proxy_group_name}' but remove failed.")
            else:
                current_logger.warning(f"No suitable dialer group found for landing node '{proxy_name}'. It will not be configured for auto chain dialing.")

    output = StringIO()
    yaml.dump(config, output)
    return output.getvalue()
# --- process_subscription 和 find_matching_dialer_group 函数结束 ---


class CustomHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed_url = urlparse(self.path)
        script_dir = os.path.dirname(os.path.abspath(__file__)) # 获取脚本所在目录

        if parsed_url.path == "/subscription.yaml":
            query_params = parse_qs(parsed_url.query)
            logger.info(f"Request for /subscription.yaml with params: {query_params}")

            remote_url_list = query_params.get('remote_url', [])
            if not remote_url_list or not remote_url_list[0]:
                self.send_error_response("Missing 'remote_url' query parameter.", 400)
                return
            remote_url = remote_url_list[0]

            try:
                manual_dialer_enabled_str = query_params.get('manual_dialer_enabled', ['1'])[0]
                if manual_dialer_enabled_str not in ['0', '1']:
                    logger.warning(f"Invalid manual_dialer_enabled value '{manual_dialer_enabled_str}', defaulting to '1' (manual).")
                    manual_dialer_enabled_str = '1'
                manual_dialer_enabled = int(manual_dialer_enabled_str)

                manual_pairs_encoded_str = query_params.get('manual_pairs', [''])[0]
                manual_pairs_str = ""
                if manual_pairs_encoded_str:
                    manual_pairs_str = unquote(manual_pairs_encoded_str)

                manual_pairs_list = []
                if manual_dialer_enabled == 1 and manual_pairs_str:
                    pairs = manual_pairs_str.split(',')
                    for pair_str in pairs:
                        if not pair_str.strip(): continue
                        parts = pair_str.split(':', 1)
                        if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                            manual_pairs_list.append((parts[0].strip(), parts[1].strip()))
                        else:
                            logger.warning(f"Malformed manual pair string part: '{pair_str}', skipping.")

                modified_yaml = process_subscription(
                    remote_url,
                    manual_dialer_enabled,
                    manual_pairs_list,
                    logger
                )

                self.send_response(200)
                self.send_header("Content-Type", "text/yaml; charset=utf-8")
                self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                self.end_headers()
                self.wfile.write(modified_yaml.encode("utf-8"))

            except requests.Timeout:
                logger.error("Request to remote_url timed out")
                self.send_error_response("Request to remote_url timed out", 503)
            except requests.RequestException as e:
                logger.error(f"Request error for remote_url: {str(e)}")
                self.send_error_response(f"Error fetching remote_url: {str(e)}", 502)
            except ValueError as e:
                logger.error(f"Processing error: {str(e)}", exc_info=True)
                self.send_error_response(f"Processing error: {str(e)}", 400 if "Invalid YAML" in str(e) or "Missing 'remote_url'" in str(e) else 500)
            except Exception as e:
                logger.error(f"Unexpected error: {str(e)}", exc_info=True)
                self.send_error_response(f"Unexpected server error: {str(e)}", 500)

        elif parsed_url.path == "/" or parsed_url.path == "/frontend.html": # 处理 / 和 /frontend.html
            frontend_file_path = os.path.join(script_dir, "frontend.html")
            self.serve_static_file(frontend_file_path, "text/html; charset=utf-8")

        elif parsed_url.path == "/script.js": # 新增: 处理 /script.js
            script_file_path = os.path.join(script_dir, "script.js")
            self.serve_static_file(script_file_path, "application/javascript; charset=utf-8")

        # 可以添加更多 elif 来处理其他静态文件，例如 CSS 或图片
        # elif parsed_url.path.endswith(".css"):
        #     file_path = os.path.join(script_dir, parsed_url.path.lstrip('/'))
        #     self.serve_static_file(file_path, "text/css; charset=utf-8")

        else:
            # 尝试作为通用静态文件服务 (可选，但要注意安全性)
            # 为简化，我们先只处理明确指定的文件，其他返回404
            # 如果需要更通用的静态文件服务，需要更复杂的路径处理和安全检查
            self.send_error_response(f"Resource not found: {self.path}", 404)

    # 在 CustomHandler 类或全局定义
    ALLOWED_EXTENSIONS = {'.html', '.js', '.css'} # 根据你的实际需要添加

    # 修改 serve_static_file 方法
    def serve_static_file(self, file_path, content_type):
        """辅助方法，用于提供静态文件服务"""
        try:
            # --- 新增扩展名检查 ---
            ext = os.path.splitext(file_path)[1].lower()
            if ext not in self.ALLOWED_EXTENSIONS: # 引用类或全局变量
                logger.warning(f"Attempt to access disallowed file type: {ext} for path {file_path}")
                self.send_error_response(f"File type {ext} not allowed", 403) # Forbidden
                return
            # --- 扩展名检查结束 ---

            script_dir = os.path.dirname(os.path.abspath(__file__))
            normalized_script_dir = os.path.normcase(os.path.normpath(script_dir))
            normalized_file_path = os.path.normcase(os.path.normpath(os.path.realpath(file_path)))

            if not normalized_script_dir.endswith(os.sep):
                normalized_script_dir += os.sep
            if not normalized_file_path.startswith(normalized_script_dir):
                logger.warning(f"Attempt to access file outside of script directory.")
                logger.warning(f"Normalized Script Dir: {normalized_script_dir}")
                logger.warning(f"Normalized File Path: {normalized_file_path}")
                self.send_error_response(f"Access denied to: {self.path}", 403)
                return

            if not os.path.exists(file_path) or not os.path.isfile(file_path):
                logger.warning(f"Static file not found or is not a file: {file_path}")
                self.send_error_response(f"Resource not found: {self.path}", 404)
                return

            with open(file_path, "rb") as f:
                content_to_serve = f.read()
            logger.info(f"Serving static file: {file_path} as {content_type}")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.end_headers()
            self.wfile.write(content_to_serve)
    # ... (except 块保持不变) ...
        except FileNotFoundError:
            logger.error(f"Static file not found (race condition or other issue): {file_path}.")
            self.send_error_response(f"Resource not found: {self.path}", 404)
        except Exception as e:
            logger.error(f"Error reading or serving static file {file_path}: {e}", exc_info=True)
            self.send_error_response(f"Error serving file: {e}", 500)


    def send_error_response(self, message, code=500):
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

    def log_message(self, format, *args):
        # 使用配置好的 logger 记录调试信息，而不是默认的 stderr
        logger.debug(f"HTTP Request from {self.address_string()}: {args[0]} Status: {args[1]} Size: {args[2]}")
        return

if __name__ == "__main__":
    if not os.path.exists(LOG_DIR):
        try:
            os.makedirs(LOG_DIR)
            logger.info(f"Created log directory: {LOG_DIR}")
        except OSError as e:
            logger.error(f"Could not create log directory {LOG_DIR}: {e}", exc_info=True)

    logger.info(f"Starting server on port {PORT}...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    logger.info(f"Script directory: {script_dir}")
    logger.info(f"Expected frontend.html path: {os.path.join(script_dir, 'frontend.html')}")
    logger.info(f"Expected script.js path: {os.path.join(script_dir, 'script.js')}")


    # 初始化 mimetypes，如果需要更广泛的文件类型支持
    mimetypes.init()
    # 可以添加自定义的 MIME 类型，如果 mimetypes 模块不认识 .js 或其他你需要的文件
    # mimetypes.add_type("application/javascript", ".js")
    # mimetypes.add_type("text/css", ".css")

    with ThreadingHTTPServer(("", PORT), CustomHandler) as httpd:
        logger.info(f"Serving at http://0.0.0.0:{PORT}")
        logger.info("--- Chain SubConverter Service Started ---")
        logger.info(f"Access the frontend configurator at http://<your_server_ip_or_localhost>:{PORT}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            logger.info("Server is shutting down...")
        finally:
            httpd.server_close()
            logger.info("Server shut down successfully.")