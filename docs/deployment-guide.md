# 部署指导书

本指导书说明如何在华为云部署 `internet-rss-content-aggregator` 并完成内容聚合演示与前端展示。

## 1. 前置条件

- 华为云账号（已实名认证），区域 `cn-north-4`
- Terraform ≥ 1.5、obsutil
- 访问密钥（在「我的凭证」创建），具备 FunctionGraph / OBS 操作权限

## 2. 配置并部署

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # 修改 region / project_name / obs_bucket_name
export HW_ACCESS_KEY="<your-access-key>"
export HW_SECRET_KEY="<your-secret-key>"
terraform init
terraform plan
terraform apply -auto-approve
```

apply 完成后记录输出：`static_url`（前端地址）与 `orchestrator_urn`（聚合函数）。

## 3. 上传前端静态站

```bash
# 将前端文件上传到 OBS 静态桶
obsutil cp src/frontend/index.html obs://<obs-bucket-name>/index.html -f
obsutil cp src/frontend/content.json obs://<obs-bucket-name>/content.json -f
```

## 4. 验证内容聚合

```bash
# 手动触发聚合（mock 模式，无需公网）
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[]}'
# 期望：{"statusCode":200,"body":"{\"items\":[<2 条示例>],\"total\":2,\"duplicates\":0}"}

# 再次携带 existing 验证去重
hcloud FunctionGraph InvokeFunction --cli-region=cn-north-4 \
  --function_urn="<orchestrator_urn>" \
  --body='{"source":"mock","existing":[{"link":"https://example.com/posts/serverless-pipelines"}]}'
# 期望：duplicates=1（已存在条目被去重），total 正确累加
```

## 5. 配置定时触发（可选）

在 FunctionGraph 控制台 → 函数 → 触发器 → 创建定时触发器（cron 表达式，如每天执行），事件体 `{"source":"live","existing":[]}`；`live` 模式需要函数具备公网出口（默认无配置时可访问公网；若无法访问，保持 `mock` 演示）。

## 6. 前端访问

浏览器打开 `static_url`，应看到预置的聚合内容列表（由 `content.json` 渲染）。

## 7. 真实持久化（可选）

生产环境中把聚合结果持久化，两种方式任选：

- **对象存储**：在聚合函数中写入 OBS `content.json`（需函数配置 `OBS OperateAccess` 委托且生效）
- **缓存服务**：接入 Redis，由查询接口返回聚合列表（需函数接入 VPC）

## 8. 清理资源

```bash
cd infra
terraform destroy -auto-approve
# 手动删除 OBS 桶与对象
obsutil rm obs://<obs-bucket-name> -r -f
obsutil rm obs://<obs-bucket-name> -f
```