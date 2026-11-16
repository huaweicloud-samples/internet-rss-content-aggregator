# ============================================================================
# 内容聚合器（华为云 FunctionGraph + OBS 静态托管）
# ============================================================================
# 业务语义：
#   - FunctionGraph orchestrator 定时/手动触发，聚合 RSS 内容并返回/输出 items
#   - OBS 桶托管前端静态站（index.html + content.json）
# 编排说明：源为 5 函数 + 状态机；本实现聚合逻辑集中在 orchestrator 单函数，
# 真实持久化（OBS/Redis）请按文档启用（需 OBS 委托或 Redis 后端）。
# ============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    huaweicloud = {
      source  = "huaweicloud/huaweicloud"
      version = "~> 1.70"
    }
  }
}

provider "huaweicloud" {
  region         = var.region
  access_key     = var.access_key
  secret_key     = var.secret_key
  security_token = var.security_token
}

resource "huaweicloud_obs_bucket" "static" {
  bucket        = var.obs_bucket_name
  acl           = "public-read"
  force_destroy = true
  website {
    index_document = "index.html"
    error_document = "index.html"
  }
}

resource "huaweicloud_fgs_function" "orchestrator" {
  name        = "${var.project_name}-orchestrator"
  app         = "default"
  handler     = "index.handler"
  memory_size = 256
  timeout     = 60
  runtime     = "Node.js18.15"
  code_type   = "inline"
  func_code   = filebase64("../src/functions/orchestrator/index.js")
}

output "static_url" {
  description = "前端静态站访问地址"
  value       = "https://${var.obs_bucket_name}.obs.${var.region}.myhuaweicloud.com"
}

output "orchestrator_urn" {
  description = "聚合函数 URN（用于手动触发与定时触发器配置）"
  value       = huaweicloud_fgs_function.orchestrator.urn
}
