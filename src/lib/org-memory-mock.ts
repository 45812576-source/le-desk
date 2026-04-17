import type {
  OrgMemoryProposal,
  OrgMemorySnapshot,
  OrgMemorySource,
} from "@/lib/types";

export const MOCK_ORG_MEMORY_SOURCES: OrgMemorySource[] = [
  {
    id: 101,
    title: "销售组织治理文档（2026Q2）",
    source_type: "feishu_doc",
    source_uri: "https://example.feishu.cn/docx/sales-q2",
    owner_name: "销售运营组",
    external_version: "v2026.04.14",
    fetched_at: "2026-04-15T09:30:00+08:00",
    ingest_status: "ready",
    latest_snapshot_version: "snapshot-2026-04-15-01",
    latest_parse_note: "关键章节齐全，部门职责与岗位职责字段解析稳定。",
  },
  {
    id: 102,
    title: "商务部门案例协作规范",
    source_type: "markdown",
    source_uri: "repo://docs/org/biz-case-governance.md",
    owner_name: "商务管理组",
    external_version: "git:0f9eab1",
    fetched_at: "2026-04-15T14:20:00+08:00",
    ingest_status: "warning",
    latest_snapshot_version: "snapshot-2026-04-15-02",
    latest_parse_note: "案例复盘章节存在自由写法，客户匿名化要求需人工确认。",
  },
  {
    id: 103,
    title: "客户成功组织说明",
    source_type: "upload",
    source_uri: "upload://org-memory/customer-success-structure.docx",
    owner_name: "客户成功部",
    external_version: null,
    fetched_at: "2026-04-16T10:15:00+08:00",
    ingest_status: "processing",
    latest_snapshot_version: null,
    latest_parse_note: "正在抽取岗位、流程和复盘模板。",
  },
];

export const MOCK_ORG_MEMORY_SNAPSHOTS: OrgMemorySnapshot[] = [
  {
    id: 201,
    source_id: 101,
    source_title: "销售组织治理文档（2026Q2）",
    snapshot_version: "snapshot-2026-04-15-01",
    parse_status: "ready",
    confidence_score: 0.92,
    created_at: "2026-04-15T09:42:00+08:00",
    summary: "已抽取销售中心、销售管理部、商务一部等 6 类对象，用于知识库目录和 Skill 挂载建议。",
    entity_counts: {
      units: 5,
      roles: 4,
      people: 18,
      okrs: 3,
      processes: 3,
    },
    units: [
      {
        id: 1,
        name: "销售中心",
        unit_type: "org",
        parent_name: null,
        leader_name: "陈楠",
        responsibilities: ["负责全渠道销售策略", "统筹销售管理与商务协作机制"],
        evidence_refs: [
          {
            label: "组织架构章节",
            section: "1.1 组织架构",
            excerpt: "销售中心下设销售管理部、商务一部与商务二部。",
          },
        ],
      },
      {
        id: 2,
        name: "销售管理部",
        unit_type: "department",
        parent_name: "销售中心",
        leader_name: "李冉",
        responsibilities: ["维护销售 SOP", "输出销售培训与复盘资料"],
        evidence_refs: [
          {
            label: "部门职责表",
            section: "3.1 部门职责",
            excerpt: "销售管理部负责 SOP、培训资料、周月复盘机制。",
          },
        ],
      },
      {
        id: 3,
        name: "商务一部",
        unit_type: "department",
        parent_name: "销售中心",
        leader_name: "王璐",
        responsibilities: ["承接高潜客户", "沉淀客户案例与方法论"],
        evidence_refs: [
          {
            label: "花名册",
            section: "2.2 部门与岗位",
            excerpt: "商务一部由一线商务与组长组成，负责 KA 客户推进。",
          },
        ],
      },
    ],
    roles: [
      {
        id: 11,
        name: "销售经理",
        department_name: "销售管理部",
        responsibilities: ["销售策略配置", "复盘方法沉淀"],
        evidence_refs: [
          {
            label: "岗位职责",
            section: "4.1 销售经理",
            excerpt: "负责销售策略、目标拆解及复盘方法输出。",
          },
        ],
      },
      {
        id: 12,
        name: "商务顾问",
        department_name: "商务一部",
        responsibilities: ["客户推进", "案例复盘", "商机判断"],
        evidence_refs: [
          {
            label: "岗位职责",
            section: "4.3 商务顾问",
            excerpt: "负责客户跟进、案例复盘及商机判断。",
          },
        ],
      },
    ],
    people: [
      {
        id: 21,
        name: "赵安",
        department_name: "商务一部",
        role_name: "商务顾问",
        manager_name: "王璐",
        employment_status: "active",
        evidence_refs: [
          {
            label: "花名册",
            section: "2.1 花名册",
            excerpt: "赵安，商务一部，商务顾问，汇报给王璐。",
          },
        ],
      },
      {
        id: 22,
        name: "于洁",
        department_name: "销售管理部",
        role_name: "销售经理",
        manager_name: "李冉",
        employment_status: "active",
        evidence_refs: [
          {
            label: "花名册",
            section: "2.1 花名册",
            excerpt: "于洁，销售管理部，销售经理，汇报给李冉。",
          },
        ],
      },
    ],
    okrs: [
      {
        id: 31,
        owner_name: "销售中心",
        period: "2026Q2",
        objective: "提升高潜客户线索转化效率",
        key_results: ["沉淀 30 份案例卡", "形成统一跟进 SOP"],
        evidence_refs: [
          {
            label: "OKR 章节",
            section: "5.1 Q2 OKR",
            excerpt: "目标是提升高潜客户线索转化效率，KR 包含案例卡沉淀与 SOP 输出。",
          },
        ],
      },
    ],
    processes: [
      {
        id: 41,
        owner_name: "商务一部",
        name: "客户案例复盘流程",
        participants: ["商务顾问", "直属 leader", "销售经理"],
        outputs: ["案例卡", "复盘摘要", "训练素材"],
        risk_points: ["客户身份暴露", "成交金额明文扩散"],
        evidence_refs: [
          {
            label: "业务流程",
            section: "6.2 客户案例复盘流程",
            excerpt: "原始复盘仅限商务本人和直属 leader 查看，部门共享需匿名化处理。",
          },
        ],
      },
    ],
    low_confidence_items: [
      {
        label: "商务案例部门共享边界",
        reason: "文档明确了‘需匿名化’，但未完全枚举允许共享的字段范围。",
      },
    ],
  },
  {
    id: 202,
    source_id: 102,
    source_title: "商务部门案例协作规范",
    snapshot_version: "snapshot-2026-04-15-02",
    parse_status: "warning",
    confidence_score: 0.78,
    created_at: "2026-04-15T14:35:00+08:00",
    summary: "案例协作规则已抽取，但匿名化粒度与审批归口仍需人工确认。",
    entity_counts: {
      units: 3,
      roles: 2,
      people: 6,
      okrs: 1,
      processes: 2,
    },
    units: [],
    roles: [],
    people: [],
    okrs: [],
    processes: [
      {
        id: 42,
        owner_name: "商务管理组",
        name: "案例共享审批流程",
        participants: ["商务顾问", "直属 leader", "部门负责人"],
        outputs: ["匿名案例卡", "部门培训材料"],
        risk_points: ["跨部门扩散", "敏感字段识别不完整"],
        evidence_refs: [
          {
            label: "共享边界说明",
            section: "2.4 案例共享",
            excerpt: "案例原文不得直接在部门内扩散，需生成匿名案例卡后复用。",
          },
        ],
      },
    ],
    low_confidence_items: [
      {
        label: "匿名化后允许的共享范围",
        reason: "文档中只描述‘可用于培训’，未说明是否允许进入 LLM 检索。",
      },
    ],
  },
];

export const MOCK_ORG_MEMORY_PROPOSALS: OrgMemoryProposal[] = [
  {
    id: 301,
    snapshot_id: 201,
    title: "销售组织 Memory 草案 #301",
    proposal_status: "draft",
    risk_level: "medium",
    summary: "新增销售中心目录建议、案例文档共享规则和销售分析 Skill 挂载建议。",
    impact_summary: "涉及 3 个目录、2 条分类规则、2 个 Skill 挂载判断。",
    created_at: "2026-04-15T10:00:00+08:00",
    submitted_at: null,
    structure_changes: [
      {
        id: 1,
        change_type: "create",
        target_path: "/销售中心/销售管理/培训与复盘",
        dept_scope: "销售管理部",
        rationale: "部门职责和 OKR 都显示培训资料与复盘方法是稳定知识域。",
        confidence_score: 0.93,
      },
      {
        id: 2,
        change_type: "create",
        target_path: "/销售中心/商务一部/客户案例卡",
        dept_scope: "商务一部",
        rationale: "案例卡是流程输出物，适合作为匿名化后的复用容器。",
        confidence_score: 0.89,
      },
    ],
    classification_rules: [
      {
        id: 11,
        target_scope: "商务一部客户案例文档",
        match_signals: ["涉及客户复盘", "归属商务一部", "文档目的是方法复用"],
        default_folder_path: "/销售中心/商务一部/客户案例卡",
        origin_scope: "manager_chain",
        allowed_scope: "department",
        usage_purpose: "training",
        redaction_mode: "masked",
        rationale: "原始案例仅允许本人和 leader 查看，部门共享必须匿名化。",
      },
      {
        id: 12,
        target_scope: "销售培训 SOP",
        match_signals: ["涉及 SOP", "归属销售管理部", "用于培训与复盘"],
        default_folder_path: "/销售中心/销售管理/培训与复盘",
        origin_scope: "department",
        allowed_scope: "department",
        usage_purpose: "knowledge_reuse",
        redaction_mode: "raw",
        rationale: "培训 SOP 本身就是部门共享知识，不需要额外降级。",
      },
    ],
    skill_mounts: [
      {
        id: 21,
        skill_id: 402,
        skill_name: "销售复盘助手",
        target_scope: "销售管理部知识域",
        required_domains: ["培训与复盘", "销售 OKR"],
        max_allowed_scope: "department",
        required_redaction_mode: "summary",
        decision: "allow",
        rationale: "Skill 仅做复盘总结，消费摘要即可，无需原始客户信息。",
      },
      {
        id: 22,
        skill_id: 404,
        skill_name: "客户案例助手",
        target_scope: "商务一部案例卡",
        required_domains: ["客户案例卡", "复盘模板"],
        max_allowed_scope: "department",
        required_redaction_mode: "masked",
        decision: "require_approval",
        rationale: "Skill 会接触匿名化案例卡，需明确是否允许部门范围调用。",
      },
    ],
    approval_impacts: [
      {
        id: 31,
        impact_type: "knowledge.scope.expand",
        target_asset_name: "商务一部客户案例卡",
        risk_reason: "原始范围是本人/leader，现扩展到部门共享。",
        requires_manual_approval: true,
      },
      {
        id: 32,
        impact_type: "skill.mount.approve_by_org_memory",
        target_asset_name: "客户案例助手",
        risk_reason: "需要明确 Skill 是否只能消费匿名化案例卡。",
        requires_manual_approval: true,
      },
    ],
    evidence_refs: [
      {
        label: "案例复盘流程",
        section: "6.2 客户案例复盘流程",
        excerpt: "部门共享需先匿名化，再形成案例卡供培训复用。",
      },
    ],
  },
  {
    id: 302,
    snapshot_id: 202,
    title: "商务案例共享治理草案 #302",
    proposal_status: "pending_approval",
    risk_level: "high",
    summary: "收敛客户案例共享边界，要求 LLM 只消费摘要或模式提炼版本。",
    impact_summary: "涉及 1 条共享规则调整、1 个审批动作新增。",
    created_at: "2026-04-15T15:00:00+08:00",
    submitted_at: "2026-04-15T15:20:00+08:00",
    structure_changes: [],
    classification_rules: [
      {
        id: 13,
        target_scope: "商务案例复盘文档",
        match_signals: ["涉及客户名称", "包含成交节点", "文档目的是案例共享"],
        default_folder_path: "/商务管理/案例共享/匿名案例卡",
        origin_scope: "manager_chain",
        allowed_scope: "department",
        usage_purpose: "llm_qa",
        redaction_mode: "summary",
        rationale: "若供 LLM 检索，仅允许消费摘要和模式提炼，不允许原文进入共享域。",
      },
    ],
    skill_mounts: [],
    approval_impacts: [
      {
        id: 33,
        impact_type: "knowledge.redaction.lower",
        target_asset_name: "商务案例复盘文档",
        risk_reason: "如果允许读取原文，将直接扩大客户敏感信息暴露面。",
        requires_manual_approval: true,
      },
    ],
    evidence_refs: [
      {
        label: "案例共享规范",
        section: "2.4 案例共享",
        excerpt: "案例原文不得直接扩散；部门共享或模型使用都应基于摘要或去标识化版本。",
      },
    ],
  },
];
