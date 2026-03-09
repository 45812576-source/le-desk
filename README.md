# Le Desk — AI Skill Workbench

## 启动命令

### 后端（universal-kb）

```bash
cd /Users/xia/project/universal-kb/backend
uvicorn app.main:app --reload --port 8000
```

- API 文档：http://localhost:8000/docs
- 默认账号：`admin` / `admin123`

> 首次运行请参考 `backend/SETUP.md` 完成环境初始化。

### 前端（le-desk）

```bash
cd /Users/xia/project/le-desk

# 开发模式
npm run dev

# 生产模式
npm run build
npx next start -p 5023
```

- 访问地址：http://localhost:5023
- 局域网访问：http://192.168.5.202:5023

> 前端通过 `/api/proxy/[...path]` 代理后端请求，启动前请确保后端已运行。
