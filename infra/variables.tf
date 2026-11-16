variable "access_key" {
  description = "华为云 Access Key（terraform.tfvars 本地注入，不提交 git）"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "华为云 Secret Key（terraform.tfvars 本地注入，不提交 git）"
  type        = string
  sensitive   = true
}

variable "security_token" {
  description = "临时安全令牌（STS，本地验证用；使用长期访问密钥时留空）"
  type        = string
  default     = ""
  sensitive   = true
}

variable "region" {
  description = "华为云区域"
  type        = string
  default     = "cn-north-4"
}

variable "project_name" {
  description = "项目名称，用于资源命名前缀"
  type        = string
  default     = "content-agg"
}

variable "obs_bucket_name" {
  description = "前端静态托管 OBS 桶名（全局唯一）"
  type        = string
  default     = "content-agg-static"
}
