````md
# skill-registry 开发任务

## 项目定位

你正在开发一个 **Skill Registry Runtime**。

目标：

构建一个面向 AI Agent 的 Skill Catalog 和 Skill 管理系统。

它负责：

- Skill 元数据管理
- Skill 分类管理
- Skill 搜索发现
- Skill 使用统计
- Skill 推荐
- Workspace / Profile 管理
- 生成 npx skills 安装命令
- CLI 管理入口
- 本地可视化管理入口


它不负责：

- Skill 下载
- Skill 安装
- Skill 更新
- Skill 文件生命周期管理


Skill 安装统一交给：

```bash
npx skills
````

---

# 一、核心定位

## skill-registry 不是 Installer

不要实现：

```bash
registry skill install xxx
```

不要执行：

```javascript
exec("npx skills")
```

原因：

skill-registry 不应该承担：

* 网络请求
* 文件写入
* 权限处理
* 安装错误处理
* Skill 生命周期管理

它只负责：

> 管理 Skill 信息，并生成安装意图。

---

# 二、整体架构

```text
                 AI Agent / User

                       |

                       v

              skill-registry

        (Catalog + Recommendation)

                       |

        ----------------------------

        |                          |

       CLI                       HTTP UI

        |                          |

        |                          v

        |                      React UI

        |

        v

              registry-core

                       |

                       v

              Runtime Storage

                       |

                       v

              ~/.skill-registry/
```

---

# 三、职责分离

## Skill Package

负责：

* CLI 程序
* HTTP Server
* UI 静态资源
* 默认模板
* Schema

不保存：

* 用户 registry 数据
* 使用记录
* 历史修改记录

---

## Runtime Data

位置：

```bash
~/.skill-registry/
```

负责：

* 用户 Skill Catalog
* 使用统计
* Profile
* History

---

# 四、目录设计

## Skill 包

```text
skill-registry/

├── SKILL.md

├── bin/

│   └── registry.js

│
├── assets/

│   ├── templates/

│   │   ├── catalog.default.json

│   │   ├── usage.default.json

│   │   └── profiles.default.json

│   │
│   └── schemas/

│       ├── catalog.schema.json

│       ├── usage.schema.json

│       └── profiles.schema.json

│
└── ui/

    └── dist/
```

---

## 用户运行数据

```text
~/.skill-registry/

├── catalog.json

├── usage.json

├── profiles.json

├── config.json

└── history/

    └── 2026-07-15.json
```

---

# 五、初始化流程

第一次使用：

```bash
registry init
```

流程：

```text
读取 skill assets/templates

↓

复制默认模板

↓

创建 ~/.skill-registry/

↓

生成运行环境
```

---

# 六、数据模型

## catalog.json

保存 Skill 静态信息。

示例：

```json
{
 "skills":[
   {
    "name":"playwright",

    "source":{
      "repo":"xxx/xxx",
      "skill":"playwright"
    },

    "description":"browser automation skill",

    "keywords":[
      "browser",
      "e2e"
    ],

    "categories":[
      "浏览器/测试"
    ],

    "status":"active",

    "keepGlobal":false
   }
 ]
}
```

---

## usage.json

保存 Skill 使用行为。

示例：

```json
{
 "playwright":{
   "count":120,

   "lastUsed":"2026-07-15",

   "projects":[
      "frontend-project"
   ]
 }
}
```

用途：

* 热门 Skill
* 推荐
* 常用判断

---

## profiles.json

保存 Skill 组合。

示例：

```json
{
 "frontend-vue":{
    "skills":[
      "playwright",
      "vue-debug"
    ]
 }
}
```

用途：

根据项目类型快速选择 Skill。

---

## history/

记录所有重要修改。

示例：

```json
{
 "action":"update-category",

 "skill":"playwright",

 "actor":"AI",

 "reason":"30 days usage high"
}
```

用途：

* 回溯
* 审计
* AI 修改追踪

---

# 七、分类设计

分类属于人工标签。

例如：

```text
浏览器/测试

文档处理

开发流程

代码质量

设计/视觉
```

不要把：

```text
常用

热门

推荐
```

作为分类。

这些属于：

动态计算结果。

---

# 八、Usage Intelligence

系统需要支持 Skill 使用统计。

CLI：

```bash
registry usage track <skill>
```

记录：

* 使用次数
* 最近使用时间
* 使用项目

---

查看：

```bash
registry usage top
```

输出：

```text
playwright 120

skill-review 80

pdf 30
```

---

# 九、推荐系统

支持：

```bash
registry recommend
```

根据：

* 使用次数
* 最近使用时间
* Workspace 匹配
* Skill 分类

生成推荐。

示例：

```text
推荐 Skill:

playwright

原因:

- 最近30天使用120次
- 当前项目属于 frontend
- 浏览器测试匹配
```

---

# 十、npx skills 集成

skill-registry 不执行安装。

只生成命令。

新增：

```bash
registry skill install-command <name>
```

输出：

```bash
npx skills add xxx \
--skill playwright \
-a claude-code \
-y
```

支持：

```bash
--json
```

方便 AI 调用。

---

# 十一、registry-core

核心模块负责：

## Storage

* 读取 JSON
* 保存 JSON
* 原子写入

## Validation

校验：

* name 唯一
* description 非空
* category 合法
* source 合法

## CRUD

支持：

```text
add

remove

update

list

show

search
```

## Recommendation

支持：

```text
usage analysis

skill ranking

recommendation
```

---

# 十二、CLI

入口：

```bash
node ./bin/registry.js
```

## Skill

```bash
registry skill list

registry skill search vue

registry skill show playwright

registry skill add

registry skill remove

registry skill edit
```

---

## Usage

```bash
registry usage track playwright

registry usage top
```

---

## Recommend

```bash
registry recommend
```

---

## Install Command

```bash
registry skill install-command playwright
```

所有查询命令支持：

```bash
--json
```

方便 Agent 消费。

---

# 十三、HTTP API

HTTP 只作为 UI 后端。

要求：

* 绑定 127.0.0.1
* 不暴露公网
* 所有修改经过 registry-core

采用 REST。

---

## Skills

```http
GET    /api/skills

GET    /api/skills/:name

POST   /api/skills

PATCH  /api/skills/:name

DELETE /api/skills/:name
```

---

## Search

```http
GET /api/search?q=
```

---

## Usage

```http
POST /api/usage/:skill
```

---

## Recommend

```http
GET /api/recommend
```

---

# 十四、React UI

React 只是展示层。

不要包含业务逻辑。

第一阶段：

完成：

1. registry-core

2. CLI

3. HTTP API

第二阶段：

实现：

* Skill 浏览
* Skill 分类
* Skill 搜索
* 使用统计
* 推荐展示
* Profile 管理

---

# 十五、工程实现顺序

严格按照：

```text
Phase 1

Storage

↓

Schema

↓

registry-core


Phase 2

CLI


Phase 3

HTTP API


Phase 4

React UI


Phase 5

Usage Intelligence


Phase 6

AI Recommendation
```

---

# 十六、开发原则

1. Skill 包和用户数据必须分离。

2. assets 保存模板和 schema。

3. ~/.skill-registry 保存运行数据。

4. 不实现安装器。

5. npx skills 是唯一安装执行器。

6. AI 可以维护 registry，但必须通过 CLI/API。

7. 不允许 AI 直接修改 JSON。

8. 所有修改必须经过 validation。

9. 保持 JSON 存储，暂不引入数据库。

---

# 开始任务

第一阶段：

实现：

* storage layer
* schema
* registry-core
* registry init
* CLI CRUD

不要实现：

* React UI
* 安装执行
* AI 自动修改

先保证数据模型和核心能力稳定。

后续根据真实使用继续演化。

```
```
