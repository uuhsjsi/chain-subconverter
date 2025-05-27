import http.server
import requests
import logging
import logging.handlers
import os
import re
from ruamel.yaml import YAML
from ruamel.yaml.compat import StringIO
from http.server import ThreadingHTTPServer # 使用 ThreadingHTTPServer 处理并发请求
from urllib.parse import urlparse, parse_qs, unquote, urlencode # 增加了 urlencode
import mimetypes
import datetime
import json
import traceback

# --- 配置日志开始 ---
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
PORT = int(os.getenv("PORT", 11200))

# 更新并重命名 REGION_MAPPING
REGION_KEYWORD_CONFIG = [
    {"id": "HK", "name": "Hong Kong", "keywords": ["HK", "HongKong", "Hong Kong", "香港", "🇭🇰"]},
    {"id": "US", "name": "United States", "keywords": ["US", "USA", "UnitedStates", "United States", "美国", "🇺🇸"]},
    {"id": "JP", "name": "Japan", "keywords": ["JP", "Japan", "日本", "🇯🇵"]},
    {"id": "SG", "name": "Singapore", "keywords": ["SG", "Singapore", "新加坡", "🇸🇬"]},
    {"id": "TW", "name": "Taiwan", "keywords": ["TW", "Taiwan", "台湾", "🇼🇸"]},
    {"id": "KR", "name": "Korea", "keywords": ["KR", "Korea", "韩国", "🇰🇷"]},
    # 可以根据需要添加更多区域
]
LANDING_NODE_KEYWORDS = ["Landing", "落地"] # 用于自动识别落地节点

yaml = YAML()
yaml.preserve_quotes = True
yaml.indent(mapping=2, sequence=4, offset=2)
yaml.width = float('inf')
yaml.explicit_start = True
# --- 全局配置结束 ---

# --- 日志辅助函数 ---
def _add_log_entry(logs_list, level, message, an_exception=None):
    """将日志条目添加到列表，并使用标准logger记录。"""
    timestamp = datetime.datetime.utcnow().isoformat() + "Z"
    log_entry = {"timestamp": timestamp, "level": level.upper(), "message": str(message)}
    logs_list.append(log_entry)

    if level.upper() == "ERROR":
        logger.error(message, exc_info=an_exception if an_exception else False)
    elif level.upper() == "WARN":
        logger.warning(message)
    elif level.upper() == "DEBUG":
        logger.debug(message)
    else: # INFO
        logger.info(message)

# --- 核心逻辑函数 ---
def apply_node_pairs_to_config(config_object, node_pairs_list):
    """
    将节点对应用到配置对象中。
    config_object: 已解析的YAML内容 (Python字典)。
    node_pairs_list: 一个包含 (landing_node_name, front_node_name) 元组的列表。
    返回: (success_boolean, modified_config_object, logs_list)
    """
    logs = []
    _add_log_entry(logs, "info", f"开始应用 {len(node_pairs_list)} 个节点对到配置中。")

    if not isinstance(config_object, dict):
        _add_log_entry(logs, "error", "无效的配置对象：不是一个字典。")
        return False, config_object, logs
        
    proxies = config_object.get("proxies")
    proxy_groups = config_object.get("proxy-groups")

    if not isinstance(proxies, list):
        _add_log_entry(logs, "error", "配置对象中缺少有效的 'proxies' 部分。")
        return False, config_object, logs
    # proxy_groups 可以不存在或为空，但如果存在，应该是列表
    if "proxy-groups" in config_object and not isinstance(proxy_groups, list):
        _add_log_entry(logs, "warn", "配置对象中的 'proxy-groups' 部分无效（不是列表），可能会影响组操作。")
        proxy_groups = [] # 将其视为空列表以避免后续错误

    applied_count = 0
    for landing_name, front_name in node_pairs_list:
        _add_log_entry(logs, "debug", f"尝试应用节点对: 落地='{landing_name}', 前置='{front_name}'.")
        
        landing_node_found = False
        for proxy_node in proxies:
            if isinstance(proxy_node, dict) and proxy_node.get("name") == landing_name:
                landing_node_found = True
                proxy_node["dialer-proxy"] = front_name
                _add_log_entry(logs, "info", f"成功为落地节点 '{landing_name}' 设置 'dialer-proxy' 为 '{front_name}'.")
                applied_count += 1

                # 尝试从前置组中移除落地节点（如果前置是组）
                if isinstance(proxy_groups, list):
                    for grp in proxy_groups:
                        if isinstance(grp, dict) and grp.get("name") == front_name:
                            group_proxies_list = grp.get("proxies")
                            if isinstance(group_proxies_list, list) and landing_name in group_proxies_list:
                                try:
                                    group_proxies_list.remove(landing_name)
                                    _add_log_entry(logs, "info", f"已从前置组 '{front_name}' 的节点列表中移除落地节点 '{landing_name}'。")
                                except ValueError:
                                    _add_log_entry(logs, "warn", f"尝试从前置组 '{front_name}' 移除落地节点 '{landing_name}' 时失败 (ValueError)。")
                            break # 已找到并处理前置组
                break # 已找到并处理落地节点

        if not landing_node_found:
            _add_log_entry(logs, "warn", f"节点对中的落地节点 '{landing_name}' 未在 'proxies' 列表中找到，已跳过此对。")

    if applied_count == len(node_pairs_list) and len(node_pairs_list) > 0:
        _add_log_entry(logs, "info", f"成功应用所有 {applied_count} 个节点对。")
    elif applied_count > 0:
        _add_log_entry(logs, "warn", f"成功应用 {applied_count} 个（共 {len(node_pairs_list)} 个）节点对。部分节点对可能被跳过。")
    elif len(node_pairs_list) > 0 : # applied_count is 0
        _add_log_entry(logs, "error", "未能应用任何提供的节点对。")
        return False, config_object, logs # 如果一个都没应用成功，可以考虑整体失败
    
    # 如果没有任何节点对需要应用，也视为成功
    if len(node_pairs_list) == 0:
        _add_log_entry(logs, "info", "没有提供节点对，未进行修改。")

    return True, config_object, logs


# --- 关键字匹配辅助函数 ---
def _keyword_match(text_to_search, keyword_to_find):
    """
    执行关键字匹配。
    - 如果关键字主要包含英文字符，则使用正则表达式进行全词/词组边界匹配（忽略大小写）。
    - 否则（例如纯中文），使用直接子字符串包含匹配（忽略大小写）。
    """
    if not text_to_search or not keyword_to_find:
        return False

    text_lower = text_to_search.lower()
    keyword_lower = keyword_to_find.lower()

    # 判断关键字是否包含英文字母
    if re.search(r'[a-zA-Z]', keyword_to_find):  # 英文或中英混合关键字规则
        # (?<![a-zA-Z]) 表示前面不是英文字母 (边界)
        # (?![a-zA-Z]) 表示后面不是英文字母 (边界)
        # re.escape确保关键字中的特殊字符被正确处理
        pattern_str = r'(?<![a-zA-Z])' + re.escape(keyword_lower) + r'(?![a-zA-Z])'
        try:
            if re.search(pattern_str, text_lower): # re.search会忽略大小写，因为text_lower和pattern_str中的keyword_lower都是小写
                                                # 如果要严格通过pattern控制，可以给re.search加re.IGNORECASE，并用原始keyword_to_find
                return True
        except re.error as e:
            # 一般来说，由配置提供的关键字不应导致正则错误。如果发生，需要检查关键字配置。
            # 此处我们简单地认为匹配失败。可以在日志中记录此错误，但此辅助函数目前不直接操作日志列表。
            logger.debug(f"Regex error during keyword match for keyword '{keyword_to_find}': {e}") # 使用全局logger记录调试信息
            pass 
    else:  # 非英文 (例如纯中文) 关键字规则
        if keyword_lower in text_lower:
            return True
    
    return False

# --- 核心逻辑函数 ---
# apply_node_pairs_to_config 函数 (来自上次代码) 保持不变

def perform_auto_detection(config_object, region_keyword_config, landing_node_keywords_config):
    """
    分析配置对象，自动检测落地节点并建议 (落地节点, 前置节点/组) 对。
    返回: (suggested_pairs_list, logs_list)
    suggested_pairs_list 是 [{"landing": "name", "front": "name"}, ...] 格式。
    """
    logs = []
    _add_log_entry(logs, "info", "开始自动节点对检测。")
    suggested_pairs = []

    if not isinstance(config_object, dict):
        _add_log_entry(logs, "error", "无效的配置对象：不是一个字典。")
        return [], logs

    proxies = config_object.get("proxies")
    proxy_groups = config_object.get("proxy-groups") # 可能为 None 或非列表

    if not isinstance(proxies, list):
        _add_log_entry(logs, "error", "配置对象中缺少有效的 'proxies' 列表，无法进行自动检测。")
        return [], logs
    
    if not isinstance(proxy_groups, list): # 如果 proxy_groups 无效或缺失，记录警告
        _add_log_entry(logs, "warn", "'proxy-groups' 部分缺失或无效，自动检测前置组的功能将受影响。")
        # 在后续逻辑中，对 proxy_groups 的使用需要考虑到它可能不是一个有效的列表

    for proxy_node in proxies:
        if not isinstance(proxy_node, dict):
            _add_log_entry(logs, "debug", f"跳过 'proxies' 中的无效条目: {proxy_node}")
            continue
        
        proxy_name = proxy_node.get("name")
        if not proxy_name:
            _add_log_entry(logs, "debug", f"跳过 'proxies' 中缺少名称的节点: {proxy_node}")
            continue

        # 1. 识别落地节点
        is_landing = False
        for l_kw in landing_node_keywords_config:
            if _keyword_match(proxy_name, l_kw):
                is_landing = True
                break
        
        if not is_landing:
            _add_log_entry(logs, "debug", f"节点 '{proxy_name}' 未被识别为落地节点，跳过。")
            continue
        
        _add_log_entry(logs, "info", f"节点 '{proxy_name}' 被识别为潜在的落地节点。开始为其查找前置...")

        # 2. 确定落地节点区域
        matched_region_ids = set()
        for region_def in region_keyword_config:
            for r_kw in region_def.get("keywords", []):
                if _keyword_match(proxy_name, r_kw):
                    matched_region_ids.add(region_def.get("id"))
                    break # 当前 region_def 的一个关键字匹配成功即可
        
        if not matched_region_ids:
            _add_log_entry(logs, "warn", f"落地节点 '{proxy_name}': 未能识别出任何区域。跳过此节点。")
            continue
        if len(matched_region_ids) > 1:
            _add_log_entry(logs, "error", f"落地节点 '{proxy_name}': 识别出多个区域 {list(matched_region_ids)}，区域不明确。跳过此节点。")
            continue
        
        target_region_id = matched_region_ids.pop()
        _add_log_entry(logs, "info", f"落地节点 '{proxy_name}': 成功识别区域ID为 '{target_region_id}'.")

        target_region_keywords_for_dialer_search = []
        for region_def in region_keyword_config:
            if region_def.get("id") == target_region_id:
                target_region_keywords_for_dialer_search = region_def.get("keywords", [])
                break
        
        if not target_region_keywords_for_dialer_search:
            _add_log_entry(logs, "error", f"内部错误：区域ID '{target_region_id}' 未找到对应的关键字列表。跳过落地节点 '{proxy_name}'.")
            continue

        # 3. 查找前置代理 (Dialer Proxy)
        found_dialer_name = None
        
        # 3a. 优先查找节点组
        if isinstance(proxy_groups, list): # 确保 proxy_groups 是有效列表才进行查找
            matching_groups = []
            for group in proxy_groups:
                if not isinstance(group, dict): continue
                group_name = group.get("name")
                if not group_name: continue
                
                for r_kw in target_region_keywords_for_dialer_search:
                    if _keyword_match(group_name, r_kw):
                        matching_groups.append(group_name)
                        break # 当前组已匹配，无需再用此区域的其他关键字匹配
            
            if len(matching_groups) == 1:
                found_dialer_name = matching_groups[0]
                _add_log_entry(logs, "info", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 找到唯一匹配的前置组: '{found_dialer_name}'.")
            elif len(matching_groups) > 1:
                _add_log_entry(logs, "error", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 找到多个匹配的前置组 {matching_groups}，无法自动选择。跳过此节点。")
                continue # 跳到下一个落地节点
            else: # len(matching_groups) == 0
                _add_log_entry(logs, "info", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 未找到匹配的前置组。将尝试查找节点。")
        else:
            _add_log_entry(logs, "debug", "跳过查找前置组，因为 'proxy-groups' 缺失或无效。")

        # 3b. 如果未找到唯一节点组，则查找代理节点
        if not found_dialer_name:
            matching_nodes = []
            for candidate_proxy in proxies:
                if not isinstance(candidate_proxy, dict): continue
                candidate_name = candidate_proxy.get("name")
                if not candidate_name or candidate_name == proxy_name: # 排除自身
                    continue
                
                for r_kw in target_region_keywords_for_dialer_search:
                    if _keyword_match(candidate_name, r_kw):
                        matching_nodes.append(candidate_name)
                        break # 当前候选节点已匹配
            
            if len(matching_nodes) == 1:
                found_dialer_name = matching_nodes[0]
                _add_log_entry(logs, "info", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 找到唯一匹配的前置节点: '{found_dialer_name}'.")
            elif len(matching_nodes) > 1:
                _add_log_entry(logs, "error", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 找到多个匹配的前置节点 {matching_nodes}，无法自动选择。跳过此节点。")
                continue # 跳到下一个落地节点
            else: # len(matching_nodes) == 0
                 _add_log_entry(logs, "warn", f"落地节点 '{proxy_name}': 在区域 '{target_region_id}' 也未能找到匹配的前置节点。")


        # 4. 如果成功找到前置，添加到结果列表
        if found_dialer_name:
            suggested_pairs.append({"landing": proxy_name, "front": found_dialer_name})
            _add_log_entry(logs, "info", f"成功为落地节点 '{proxy_name}' 自动配置前置为 '{found_dialer_name}'.")
        # else: (已在上面记录了未找到的警告)

    _add_log_entry(logs, "info", f"自动节点对检测完成，共找到 {len(suggested_pairs)} 对建议。")
    if not suggested_pairs and len(proxies) > 0: # 有节点但没找到任何配对
        _add_log_entry(logs, "warn", "未自动检测到任何可用的节点对。请检查节点命名是否符合预设的关键字规则，或调整关键字配置。")

    return suggested_pairs, logs

# --- HTTP 处理器 ---
class CustomHandler(http.server.SimpleHTTPRequestHandler):
    # 静态文件服务的允许扩展名列表
    ALLOWED_EXTENSIONS = {'.html', '.js', '.css', '.ico', '.png', '.jpg', '.jpeg', '.gif'}

    def send_json_response(self, data_dict, http_status_code):
        """辅助方法，用于发送JSON响应。"""
        try:
            response_body = json.dumps(data_dict, ensure_ascii=False).encode('utf-8')
            self.send_response(http_status_code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate") # 禁止缓存API响应
            self.end_headers()
            self.wfile.write(response_body)
        except Exception as e:
            _error_logs = []
            _add_log_entry(_error_logs, "error", f"发送JSON响应时发生严重内部错误: {e}", e)
            # 尝试发送一个极简的JSON错误，如果连这个都失败，就没办法了
            try:
                fallback_error = {"success": False, "message": "服务器在格式化响应时发生严重错误。", "logs": _error_logs}
                response_body = json.dumps(fallback_error, ensure_ascii=False).encode('utf-8')
                self.send_response(500)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Content-Length", str(len(response_body)))
                self.end_headers()
                self.wfile.write(response_body)
            except: # 终极捕获，如果连发送JSON错误信息都失败
                self.send_response(500) # 发送一个通用的500状态码
                self.send_header("Content-Type", "text/plain; charset=utf-8")
                self.end_headers()
                self.wfile.write(b"Critical server error during response generation.")


    def _get_config_from_remote(self, remote_url, logs_list_ref):
        """辅助方法：从远程URL获取并解析YAML配置。"""
        if not remote_url:
            _add_log_entry(logs_list_ref, "error", "必须提供 'remote_url'。")
            return None
        try:
            _add_log_entry(logs_list_ref, "info", f"正在请求远程订阅: {remote_url}")
            response = requests.get(remote_url, timeout=15)
            response.raise_for_status()
            _add_log_entry(logs_list_ref, "info", f"远程订阅获取成功，状态码: {response.status_code}")
            
            config_content = response.content
            if config_content.startswith(b'\xef\xbb\xbf'): #移除BOM
                config_content = config_content[3:]
                _add_log_entry(logs_list_ref, "debug", "已移除UTF-8 BOM。")

            config_object = yaml.load(config_content)
            if not isinstance(config_object, dict) or \
               not isinstance(config_object.get("proxies"), list): # 至少要有proxies
                _add_log_entry(logs_list_ref, "error", "远程YAML格式无效或缺少 'proxies' 列表。")
                return None
            _add_log_entry(logs_list_ref, "debug", "远程配置解析成功。")
            return config_object
        except requests.Timeout:
            _add_log_entry(logs_list_ref, "error", f"请求远程订阅 '{remote_url}' 超时。")
            return None
        except requests.RequestException as e:
            _add_log_entry(logs_list_ref, "error", f"请求远程订阅 '{remote_url}' 发生错误: {e}", e)
            return None
        except Exception as e: # ruamel.yaml.YAMLError is a subclass of Exception
            _add_log_entry(logs_list_ref, "error", f"解析远程订阅 '{remote_url}' 的YAML内容时出错: {e}", e)
            return None

    def do_POST(self):
        """处理POST请求，主要用于 /api/validate_configuration。"""
        parsed_url = urlparse(self.path)
        logs = [] # 初始化操作日志列表

        if parsed_url.path == "/api/validate_configuration":
            try:
                content_length = int(self.headers.get('Content-Length', 0))
                if content_length == 0:
                    _add_log_entry(logs, "error", "请求体为空。")
                    self.send_json_response({
                        "success": False, 
                        "message": "请求体为空。", 
                        "logs": logs
                    }, 400)
                    return

                post_body = self.rfile.read(content_length)
                _add_log_entry(logs, "debug", f"收到的原始POST数据: {post_body[:200]}") # 只记录前200字节
                data = json.loads(post_body.decode('utf-8'))
                
                remote_url = data.get("remote_url")
                # node_pairs 应为 [{"landing": "L1", "front": "F1"}, ...] 格式
                # 需要转换为 apply_node_pairs_to_config 期望的 [("L1", "F1"), ...] 格式
                node_pairs_from_request = data.get("node_pairs", [])
                if not isinstance(node_pairs_from_request, list):
                     _add_log_entry(logs, "error", "请求中的 'node_pairs' 格式无效，应为列表。")
                     raise ValueError("node_pairs格式无效")

                node_pairs_tuples = []
                for pair_dict in node_pairs_from_request:
                    if isinstance(pair_dict, dict) and "landing" in pair_dict and "front" in pair_dict:
                        node_pairs_tuples.append((str(pair_dict["landing"]), str(pair_dict["front"])))
                    else:
                        _add_log_entry(logs, "warn", f"提供的节点对 '{pair_dict}' 格式不正确，已跳过。")
                
                _add_log_entry(logs, "info", f"开始验证配置: remote_url='{remote_url}', 节点对数量={len(node_pairs_tuples)}")

                config_object = self._get_config_from_remote(remote_url, logs)
                if config_object is None: # _get_config_from_remote 内部已记录错误到logs
                    self.send_json_response({
                        "success": False,
                        "message": "无法获取或解析远程配置以进行验证。" + (f" 详情: {logs[-1]['message']}" if logs else ""),
                        "logs": logs
                    }, 400) # 400 Bad Request 或 502 Bad Gateway 取决于具体错误
                    return

                success, _modified_obj, apply_logs = apply_node_pairs_to_config(config_object, node_pairs_tuples)
                logs.extend(apply_logs)

                if success:
                    _add_log_entry(logs, "info", "配置验证成功。")
                    self.send_json_response({
                        "success": True,
                        "message": "配置验证成功。",
                        "logs": logs
                    }, 200)
                else:
                    _add_log_entry(logs, "error", "配置验证失败。")
                    self.send_json_response({
                        "success": False,
                        "message": "配置验证失败。" + (f" 详情: {logs[-1]['message']}" if logs else ""),
                        "logs": logs
                    }, 400) # 或 422 Unprocessable Entity
            
            except json.JSONDecodeError as e:
                _add_log_entry(logs, "error", f"解析请求体JSON时出错: {e}", e)
                self.send_json_response({
                    "success": False, 
                    "message": "请求体JSON格式错误。", 
                    "logs": logs
                }, 400)
            except ValueError as e: # 由我们自己逻辑抛出的，例如node_pairs格式问题
                 _add_log_entry(logs, "error", f"请求数据处理错误: {e}", e)
                 self.send_json_response({"success": False, "message": f"请求数据错误: {e}", "logs": logs}, 400)
            except Exception as e:
                _add_log_entry(logs, "error", f"处理 /api/validate_configuration 时发生意外错误: {e}", e)
                self.send_json_response({
                    "success": False, 
                    "message": "服务器内部错误。", 
                    "logs": logs
                }, 500)
        else:
            self.send_error_response("此路径不支持POST请求。", 405)


    def do_GET(self):
        parsed_url = urlparse(self.path)
        query_params = parse_qs(parsed_url.query)
        logs = [] # 初始化操作日志列表

        # API 端点
        if parsed_url.path == "/api/auto_detect_pairs":
            remote_url = query_params.get('remote_url', [None])[0]
            _add_log_entry(logs, "info", f"收到 /api/auto_detect_pairs 请求: remote_url='{remote_url}'")

            config_object = self._get_config_from_remote(remote_url, logs)
            if config_object is None:
                self.send_json_response({
                    "success": False, 
                    "message": "无法获取或解析远程配置。" + (f" 详情: {logs[-1]['message']}" if logs else ""),
                    "suggested_pairs": [], 
                    "logs": logs
                }, 400) # 或 502
                return

            suggested_pairs, detect_logs = perform_auto_detection(config_object, REGION_KEYWORD_CONFIG, LANDING_NODE_KEYWORDS)
            logs.extend(detect_logs)
            
            success_flag = True if suggested_pairs else False # 可以根据是否有结果来定，或内部逻辑判断
            final_message = f"自动检测完成，找到 {len(suggested_pairs)} 对。" if success_flag else "自动检测未找到可用节点对。"
            if not success_flag and len(logs) > 0 and logs[-1]['level'] == "WARN": # 如果最后一条是警告，也附加上
                 final_message += f" {logs[-1]['message']}"


            self.send_json_response({
                "success": success_flag,
                "message": final_message,
                "suggested_pairs": suggested_pairs,
                "logs": logs
            }, 200)

        elif parsed_url.path == "/subscription.yaml":
            remote_url = query_params.get('remote_url', [None])[0]
            # manual_pairs 参数格式: "Landing1:Front1,Landing2:Front2"
            manual_pairs_str = unquote(query_params.get('manual_pairs', [''])[0])
            
            node_pairs_list = []
            if manual_pairs_str:
                pairs = manual_pairs_str.split(',')
                for pair_str in pairs:
                    if not pair_str.strip(): continue
                    parts = pair_str.split(':', 1)
                    if len(parts) == 2 and parts[0].strip() and parts[1].strip():
                        node_pairs_list.append((parts[0].strip(), parts[1].strip()))
                    else:
                        _add_log_entry(logs, "warn", f"解析 'manual_pairs' 中的 '{pair_str}' 格式不正确，已跳过。")
            
            _add_log_entry(logs, "info", f"收到 /subscription.yaml 请求: remote_url='{remote_url}', manual_pairs='{manual_pairs_str}' (解析后 {len(node_pairs_list)} 对)")

            config_object = self._get_config_from_remote(remote_url, logs)
            if config_object is None:
                # 对于直接请求YAML的端点，失败时返回纯文本错误
                self.send_error_response(f"错误: 无法获取或解析远程配置。详情: {logs[-1]['message'] if logs else '未知错误'}", 502)
                return

            success, modified_config, apply_logs = apply_node_pairs_to_config(config_object, node_pairs_list)
            logs.extend(apply_logs) # 主要用于服务器端日志记录

            if success:
                try:
                    output = StringIO()
                    yaml.dump(modified_config, output)
                    final_yaml_string = output.getvalue()
                    _add_log_entry(logs, "info", "成功生成YAML配置。")

                    self.send_response(200)
                    self.send_header("Content-Type", "text/yaml; charset=utf-8")
                    self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                    self.send_header("Content-Disposition", f"inline; filename=\"chain_subscription_{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}.yaml\"")
                    self.end_headers()
                    self.wfile.write(final_yaml_string.encode("utf-8"))
                except Exception as e:
                    _add_log_entry(logs, "error", f"生成最终YAML时出错: {e}", e)
                    self.send_error_response(f"服务器内部错误：无法生成YAML。详情: {e}", 500)
            else:
                _add_log_entry(logs, "error", "应用节点对到配置时失败。")
                self.send_error_response(f"错误: 应用节点对失败。详情: {logs[-1]['message'] if logs else '未知错误'}", 400)
        
        # 静态文件服务
        elif parsed_url.path == "/" or parsed_url.path == "/frontend.html":
            self.serve_static_file("frontend.html", "text/html; charset=utf-8")
        elif parsed_url.path == "/script.js":
            self.serve_static_file("script.js", "application/javascript; charset=utf-8")
        elif parsed_url.path == "/favicon.ico":
            self.serve_static_file("favicon.ico", "image/x-icon")
        else:
            self.send_error_response(f"资源未找到: {self.path}", 404)

    def serve_static_file(self, file_name, content_type):
        """提供静态文件服务，增加了路径安全检查。"""
        script_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(script_dir, file_name)
        
        # 安全性：规范化路径并检查是否在脚本目录下
        normalized_script_dir = os.path.normcase(os.path.normpath(script_dir))
        normalized_file_path = os.path.normcase(os.path.normpath(os.path.realpath(file_path)))

        # 确保脚本目录路径以分隔符结尾，以便正确进行startswith检查
        if not normalized_script_dir.endswith(os.sep):
            normalized_script_dir += os.sep
            
        if not normalized_file_path.startswith(normalized_script_dir):
            logger.warning(f"禁止访问：尝试访问脚本目录之外的文件: {file_path}")
            self.send_error_response(f"禁止访问: {self.path}", 403)
            return

        ext = os.path.splitext(file_path)[1].lower()
        if ext not in self.ALLOWED_EXTENSIONS:
            logger.warning(f"禁止访问：不允许的文件类型 {ext} 对于路径 {file_path}")
            self.send_error_response(f"文件类型 {ext} 不允许访问", 403)
            return

        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            logger.warning(f"静态文件未找到或不是一个文件: {file_path}")
            self.send_error_response(f"资源未找到: {self.path}", 404)
            return
        
        try:
            with open(file_path, "rb") as f:
                content_to_serve = f.read()
            logger.info(f"正在提供静态文件: {file_path} 类型: {content_type}")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(content_to_serve)))
            # 对于HTML和JS，通常也建议不缓存或积极验证缓存
            if content_type.startswith("text/html") or content_type.startswith("application/javascript"):
                 self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.end_headers()
            self.wfile.write(content_to_serve)
        except Exception as e:
            logger.error(f"读取或提供静态文件 {file_path} 时发生错误: {e}", exc_info=True)
            self.send_error_response(f"提供文件时出错: {e}", 500)

    def send_error_response(self, message, code=500):
        """自定义的发送纯文本错误响应的方法。"""
        logger.info(f"发送错误响应: code={code}, message='{message}'") # 记录所有发送的错误
        self.send_response(code)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Content-Length", str(len(message.encode('utf-8'))))
        self.end_headers()
        self.wfile.write(message.encode("utf-8"))

    def log_message(self, format, *args):
        """覆盖基类的log_message，使其使用我们配置的logger。"""
        # args 通常是 (code, size) 或 (message)
        # format 通常是 '"%s" %s %s' % (self.requestline, str(args[0]), str(args[1]))
        # 我们只记录一个简化的调试信息，因为详细的请求参数和处理日志已在各函数中记录
        logger.debug(f"HTTP Request: {self.address_string()} {self.requestline} -> Status: {args[0] if args else 'N/A'}")
        return

# --- 主执行 ---
if __name__ == "__main__":
    if not os.path.exists(LOG_DIR):
        try:
            os.makedirs(LOG_DIR)
            logger.info(f"已创建日志目录: {LOG_DIR}")
        except OSError as e:
            logger.error(f"无法创建日志目录 {LOG_DIR}: {e}", exc_info=True)

    logger.info(f"正在启动服务，端口号: {PORT}...")
    script_dir = os.path.dirname(os.path.abspath(__file__))
    logger.info(f"脚本所在目录: {script_dir}")
    logger.info(f"前端文件 frontend.html 预期路径: {os.path.join(script_dir, 'frontend.html')}")
    logger.info(f"前端脚本 script.js 预期路径: {os.path.join(script_dir, 'script.js')}")

    mimetypes.init() # 初始化mimetypes

    httpd = ThreadingHTTPServer(("", PORT), CustomHandler)
    logger.info(f"服务已启动于 http://0.0.0.0:{PORT}")
    logger.info("--- Mihomo 链式订阅转换服务已就绪 ---")
    logger.info(f"请通过 http://<您的服务器IP或localhost>:{PORT}/ 访问前端配置页面")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        logger.info("服务正在关闭...")
    finally:
        httpd.server_close()
        logger.info("服务已成功关闭。")