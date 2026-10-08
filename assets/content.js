/* ============================================================================
 * AI Matrix Team · 落地页内容（基于 iskill-promo-page 骨架）
 *
 * 三处与默认模板不同：
 *   1. slots.members —— 五席成员卡（头像 + 人设简介）
 *   2. slots.install —— Codex / Claude Code / WorkBuddy 三种安装方式，各带一键复制提示词
 *   3. 品牌色 / 文案换成本团队的
 * ==========================================================================*/
window.PROMO = {
  name: "AI Matrix Team",
  brand: "#f59e0b",
  brand2: "#8b5cf6",
  repo: "https://github.com/aispin/ai-matrix-team",
  repoLabel: "aispin/ai-matrix-team",
  license: "MIT",
  platform: "all",

  /* ── 槽位：五席成员卡 ─────────────────────────────────────────────── */
  slots: {
    members: {
      html: {
        zh: '<div class="grid">' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/team-lead.svg" alt="PC" loading="lazy"><h3>PC · 团长</h3><p class="member-role">产研高级总监 · 兼风控守门</p><p>现京东资深总监，兼职产研首脑。老广东人，短发，薄肌，大抵是个真汉子。他极擅交际，常引来女设计师与产品经理送的小吃。风控的门，便由他守着罢。</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/product-designer.svg" alt="毛毛" loading="lazy"><h3>毛毛</h3><p class="member-role">资深产品设计师</p><p>前京东的美人，黑长直。如今身兼产品、交互、视觉三职。她是极看透了的，喜欢谈恋爱，却不愿踏进婚姻的坟。这大抵是新时代女性的一种清醒罢。</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/developer.svg" alt="Bruce" loading="lazy"><h3>Bruce</h3><p class="member-role">资深研发工程师 · 兼架构速断</p><p>前美团全栈悍将，广东茂名人。终日与编码纠缠还不够，偏要去徒步，去踢足球。南国的烈日，大约给了他无尽的精力。</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/qa.svg" alt="石头" loading="lazy"><h3>石头</h3><p class="member-role">资深质检工程师 · 独立审计</p><p>中通资深研发专家。广西容县人，两眼一睁，便能看穿千万BUG。若想吃正宗沙田柚，找他，大抵是错不了的。</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/devops.svg" alt="波波" loading="lazy"><h3>波波</h3><p class="member-role">资深运维工程师 · 发布回滚</p><p>某公司CEO，兼运维工程师。久居西安数十载，80后第一批软件工程师。性格豪爽，极爱饮酒。代码与酒，怕是他生命中唯二的解药。</p></div>' +
          '</div>',
        en: '<div class="grid">' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/team-lead.svg" alt="PC" loading="lazy"><h3>PC · Lead</h3><p class="member-role">Delivery Director · Risk gatekeeper</p><p>Senior director at JD.com and the head of product-engineering. A Cantonese veteran — short hair, lean muscle, very much his own man. So sociable that the designers and PMs keep sending snacks his way. The gate of risk control? He holds it.</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/product-designer.svg" alt="Mao" loading="lazy"><h3>毛毛 Mao</h3><p class="member-role">Senior Product Designer</p><p>Ex-JD.com. Product, interaction and visual design — three hats, one head. She has seen through it all: loves romance, wants no part in the grave of marriage. Call it the clarity of a new-era woman.</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/developer.svg" alt="Bruce" loading="lazy"><h3>Bruce</h3><p class="member-role">Senior Development Engineer</p><p>Ex-Meercat (Meituan) full-stack warrior from Maoming, Guangdong. Coding all day is not enough — he also hikes and plays football. The southern sun must have wired him with endless energy.</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/qa.svg" alt="Xue" loading="lazy"><h3>石头 Xue</h3><p class="member-role">Senior QA Engineer · Independent audit</p><p>Senior engineer at ZTO Express, from Rongxian, Guangxi. Eyes open, a thousand bugs spotted. Want an authentic Shatian pomelo? Ask him — odds are he won\'t disappoint.</p></div>' +
          '<div class="card feat"><img class="member-av" src="assets/avatars/devops.svg" alt="Bo" loading="lazy"><h3>波波 Bo</h3><p class="member-role">Senior DevOps Engineer · Release &amp; rollback</p><p>CEO of a company, and a DevOps engineer. Two decades in Xi\'an, among the first batch of software engineers of the 80s generation. Bold and fond of his drinks — code and liquor are the only two antidotes in his life.</p></div>' +
          '</div>'
      }
    },

    /* ── 槽位：三种安装方式（一键复制提示词） ────────────────────────── */
    install: {
      html: {
        zh: '<div class="grid">' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 10l2.6 2.4L7 15"/><path d="M12.5 15.2h4.2"/></svg></div><h3>Codex</h3><p>OpenAI Codex CLI 原生读 <code>SKILL.md</code>。把提示词粘给 Codex，它会 clone 到 <code>~/.codex/skills/</code>（或项目 <code>.agents/skills/</code>）。</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.codex/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>复制提示词</span></button></div><pre>请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.codex/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用</pre></div></div>' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-3.4 8-10V5.6L12 2.5 4 5.6V12c0 6.6 8 10 8 10z"/><path d="M9.4 11.8l2 2 3.4-3.8"/></svg></div><h3>Claude Code</h3><p>Claude Code 同样认 <code>SKILL.md</code> 规范。装到个人目录 <code>~/.claude/skills/</code>，或当前项目 <code>.claude/skills/</code>。</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.claude/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>复制提示词</span></button></div><pre>请把 https://github.com/aispin/ai-matrix-team 作为技能安装：clone 到 ~/.claude/skills/ai-matrix-team，然后读它的 SKILL.md，告诉我怎么用</pre></div></div>' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 8V4.8"/><circle cx="12" cy="3.6" r="1.2"/><circle cx="9.2" cy="13" r="1.15"/><circle cx="14.8" cy="13" r="1.15"/><path d="M9.5 16.4h5"/></svg></div><h3>WorkBuddy · 专家团</h3><p>WorkBuddy 里装的是<strong>五席专家团</strong>（不是单个 skill）：整团接入，团长 PC 派单，机器门禁随行。也可在专家中心搜索「AI Matrix Team」直接启用。</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="请帮我安装 AI Matrix Team 专家团：https://github.com/aispin/ai-matrix-team ，按 SKILL.md 的流程把五席专家团接入当前项目（生成项目档案、软链激活 Skill、同步安装专家包），最后跑一次门禁体检"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>复制提示词</span></button></div><pre>请帮我安装 AI Matrix Team 专家团：https://github.com/aispin/ai-matrix-team ，按 SKILL.md 的流程把五席专家团接入当前项目（生成项目档案、软链激活 Skill、同步安装专家包），最后跑一次门禁体检</pre></div></div>' +
          '</div>',
        en: '<div class="grid">' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="4" width="19" height="16" rx="3"/><path d="M7 10l2.6 2.4L7 15"/><path d="M12.5 15.2h4.2"/></svg></div><h3>Codex</h3><p>OpenAI Codex CLI reads <code>SKILL.md</code> natively. Paste the prompt — Codex clones it into <code>~/.codex/skills/</code> (or the project\'s <code>.agents/skills/</code>).</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.codex/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>Copy prompt</span></button></div><pre>Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.codex/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it</pre></div></div>' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-3.4 8-10V5.6L12 2.5 4 5.6V12c0 6.6 8 10 8 10z"/><path d="M9.4 11.8l2 2 3.4-3.8"/></svg></div><h3>Claude Code</h3><p>Claude Code speaks the same <code>SKILL.md</code> spec. Install into <code>~/.claude/skills/</code> (personal) or <code>.claude/skills/</code> (project).</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.claude/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>Copy prompt</span></button></div><pre>Install https://github.com/aispin/ai-matrix-team as a skill: clone it into ~/.claude/skills/ai-matrix-team, then read its SKILL.md and tell me how to use it</pre></div></div>' +
          '<div class="card feat"><div class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.5" y="8" width="15" height="11" rx="3.5"/><path d="M12 8V4.8"/><circle cx="12" cy="3.6" r="1.2"/><circle cx="9.2" cy="13" r="1.15"/><circle cx="14.8" cy="13" r="1.15"/><path d="M9.5 16.4h5"/></svg></div><h3>WorkBuddy · Expert Team</h3><p>In WorkBuddy you install the <strong>whole five-seat team</strong> (not a single skill): PC dispatches, machine gates enforce. You can also search 「AI Matrix Team」 in the Expert Center.</p>' +
          '<div class="code code-prompt"><div class="code-head"><span class="name">prompt</span><button type="button" class="code-copy" data-copy="Install the AI Matrix Team expert team: https://github.com/aispin/ai-matrix-team — follow SKILL.md to onboard this project (project profile, skill symlinks, expert packages), then run a gate check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="8.6" y="8.6" width="11.4" height="11.4" rx="2.4"/><path d="M15.4 5.4A2.4 2.4 0 0013 3H6.4A3.4 3.4 0 003 6.4V13a2.4 2.4 0 002.4 2.4"/></svg><span>Copy prompt</span></button></div><pre>Install the AI Matrix Team expert team: https://github.com/aispin/ai-matrix-team — follow SKILL.md to onboard this project (project profile, skill symlinks, expert packages), then run a gate check</pre></div></div>' +
          '</div>'
      }
    }
  },

  lang: {
    /* ── 中文 ───────────────────────────────────────────────────────── */
    zh: {
      meta: {
        title: "AI Matrix Team · 五席 AI 交付专家团",
        description: "五席编制的虚拟产研专家阵线：从需求、产品、设计，一路杀到研发、质检与运维，各守一关，机器门禁随行。"
      },
      a11y: { skip: "跳到主要内容" },
      ui: { copy: "复制", copied: "已复制", failed: "复制失败" },
      nav: { features: "能力", members: "成员", install: "安装", how: "上手", faq: "问答" },

      hero: {
        /* promo-sponsor */ ctaSponsor: "赞助",
        badge: "AI 专家团",
        titlePre: "五席编制，",
        titleAccent: "各守一关",
        titlePost: "",
        sub: "AI Matrix Team 是一支虚拟产研专家阵线：从需求、产品、设计，一路杀到研发、质检与运维。人一多烧词元，人太少生幻觉——五人，不多不少，刚刚好。",
        ctaPrimary: "复制安装提示词",
        ctaSecondary: "看源码",
        meta1: "五席编制",
        meta2: "机器门禁",
        meta3: "开源免费"
      },
      chat: {
        title: "AI Matrix Team · 交付现场",
        status: "五席在线",
        userLabel: "你",
        agentLabel: "PC",
        messages: [
          { role: "user", text: "接入这个新 App，走完整立项到上线流程。" },
          { role: "agent", text: "收到。已开 WO-20261008：毛毛出 BRD→PRD→设计稿，Bruce 按单施工，石头独立验收，波波负责发布。每个 Phase 过机器门禁，需要拍板的我会来问你。", tag: "WO 已开 · 门禁 3/3 通过" },
          { role: "user", text: "共享模块要动，谁把关？" },
          { role: "agent", text: "我守门。改前加锁审批，改后登记契约台账，石头月度巡检复核——不会有人悄悄改公共代码。", tag: "共享锁 · C2 核准" }
        ]
      },

      stats: [
        { value: "5", label: "五席编制", note: "不多不少，刚刚好" },
        { value: "W1–W8", label: "八条工作流", note: "从立项到巡检全程带门禁" },
        { value: "100%", label: "交接可审计", note: "WO/DR 台账逐单留痕" }
      ],

      compare: {
        eyebrow: "对比",
        title: "单人模式 vs 五席编制",
        sub: "",
        before: { title: "单线程对话式 AI", items: ["上下文一锅炖，越聊越乱", "没人守门，共享代码说改就改", "做没做完，全凭 AI 自己说"] },
        after: { title: "AI Matrix Team", items: ["专人管专事，公共区域有人守门", "机器门禁卡住每个阶段，退出码可判", "交接单留痕，随时回查审计"] }
      },

      features: {
        eyebrow: "能力",
        title: "它能做什么",
        sub: "从一句话需求到上线回滚，每个阶段都有人负责、有门禁把关。",
        items: [
          { icon: "branch", title: "立项论证", desc: "新想法先过「为什么值得做」：新闻稿推演、用户故事、投入产出账，不拍脑袋开工。" },
          { icon: "check", title: "需求与验收", desc: "每条需求都带看得见、测得了的验收标准，杜绝「体验流畅」式空话。" },
          { icon: "terminal", title: "编码与速断", desc: "动码前 15 分钟架构速断（TDD 增量 / ADR / 破坏性自查），按单施工，白名单外先问不改。" },
          { icon: "shield", title: "独立质检", desc: "写代码的人不放行：独立质检跑全套门禁、逐条核验收标准，有一票打回权。" },
          { icon: "refresh", title: "发布与回滚", desc: "上线、迁移、回滚专人负责——没有回滚方案的部署不是部署，是赌博。" },
          { icon: "layers", title: "共享面守门", desc: "多产品共用代码由专人把关：排队施工、改前审批、改后登记。" }
        ]
      },

      members: {
        eyebrow: "成员",
        title: "五席编制，各守一关",
        sub: "所谓主创者，不过是于深夜的屏幕前，念及十几年走散在各大厂的旧友——虽各奔东西，终是在这虚拟的矩阵里，重聚了。"
      },

      install: {
        eyebrow: "安装",
        title: "按你的 agent 选装法",
        sub: "普通 agent（Codex / Claude Code）装的是技能，WorkBuddy 装的是整支专家团。复制提示词，粘给对应 agent 即可。"
      },

      showcase: {
        eyebrow: "实拍",
        title: "看一眼真东西",
        sub: "",
        items: []
      },

      steps: {
        eyebrow: "上手",
        title: "三步跑起来",
        sub: "命令由 agent 跑，你只说要什么、看结果。",
        items: [
          { title: "交给 agent 装", desc: "把这句话粘进对话框，agent 会自己拉代码、读文档，再告诉你用法。", codeKey: "install" },
          { title: "说一句你要什么", desc: "需求说清就行：接入新 App、改共享模块、跑一次合规巡检……", codeName: "prompt", code: "我要接入一个新 App，走完整立项到上线流程" },
          { title: "验收交付", desc: "看门禁报告与交接单：每个 Phase 有没有过闸、遗留了哪些决策项，一目了然。", codeName: "path", code: "http://127.0.0.1:4780 · 指挥台" }
        ]
      },

      faq: {
        eyebrow: "问答",
        title: "常见问题",
        items: [
          { q: "WorkBuddy 里怎么装？", a: "在 WorkBuddy 专家中心搜索「AI Matrix Team」直接启用；或把安装区的提示词粘给 WorkBuddy，它会按 <code>SKILL.md</code> 完成接入（项目档案 + Skill 软链 + 专家包同步），并跑一次门禁体检。" },
          { q: "Codex / Claude Code 里怎么装？", a: "它们都是技能形态：clone 到对应技能目录（Codex：<code>~/.codex/skills/</code> 或项目 <code>.agents/skills/</code>；Claude Code：<code>~/.claude/skills/</code>），agent 读 <code>SKILL.md</code> 即知完整流程。上方安装区有一键复制提示词。" },
          { q: "能不能不用 AI，手动装？", a: "可以。<code>git clone</code> 下来即可——纯文本 + Node 脚本，没有构建步骤；门禁、巡检等 CLI 在 <code>scripts/</code> 下可直接运行。" },
          { q: "为什么偏偏是五个人？", a: "人一多，白白烧词元，活计还是那些活计；人太少，逻辑又生出混乱，凭空冒出幻觉。五席刚好覆盖：守门、需求与设计、施工、质检、发布。" },
          { q: "收费吗？", a: "开源免费（MIT）。所有门禁与台账都在你本地跑，数据不出机器。" }
        ]
      },

      cta: { title: "让你的 agent 有一支带纪律的交付团", desc: "复制安装提示词粘给 AI——它几秒接好，你只管拍板。", primary: "去 GitHub 看看", secondary: "复制安装提示词" },
      footer: { license: "开源免费", madeWith: "由 iskill-promo-page 生成" }
    },

    /* ── English ────────────────────────────────────────────────────── */
    en: {
      meta: {
        title: "AI Matrix Team · A five-seat AI delivery crew",
        description: "A virtual product-engineering task force: requirements, product, design, then dev, QA and ops — every stage gated by machines, every handoff auditable."
      },
      a11y: { skip: "Skip to content" },
      ui: { copy: "Copy", copied: "Copied", failed: "Copy failed" },
      nav: { features: "Features", members: "Crew", install: "Install", how: "Get started", faq: "FAQ" },

      hero: {
        /* promo-sponsor */ ctaSponsor: "Sponsor",
        badge: "AI expert team",
        titlePre: "Five seats, ",
        titleAccent: "five gates",
        titlePost: "",
        sub: "AI Matrix Team is a virtual delivery crew: requirements, product and design all the way to dev, QA and ops — each holding one gate. Too many agents burn tokens; too few breed hallucinations. Five is just right.",
        ctaPrimary: "Copy install prompt",
        ctaSecondary: "View source",
        meta1: "Five seats",
        meta2: "Machine gates",
        meta3: "Free & open source"
      },
      chat: {
        title: "AI Matrix Team · live delivery",
        status: "all seats online",
        userLabel: "You",
        agentLabel: "PC",
        messages: [
          { role: "user", text: "Onboard this new app — full pipeline from case to release." },
          { role: "agent", text: "Done. WO-20261008 opened: Mao writes BRD→PRD→design draft, Bruce builds to spec, Xue runs independent acceptance, Bo owns the release. Every phase passes a machine gate; I'll ping you when a call is yours.", tag: "WO opened · gates 3/3 passed" },
          { role: "user", text: "We need to touch a shared module. Who's gating?" },
          { role: "agent", text: "I am. Lock + approval before the change, contract ledger after, monthly compliance sweep by Xue. Nobody silently edits shared code on my watch.", tag: "shared lock · C2 approved" }
        ]
      },

      stats: [
        { value: "5", label: "seats on the crew", note: "not one more, not one less" },
        { value: "W1–W8", label: "gated workflows", note: "from case building to compliance sweeps" },
        { value: "100%", label: "auditable handoffs", note: "every WO/DR leaves a ledger trail" }
      ],

      compare: {
        eyebrow: "Comparison",
        title: "Single-threaded chat vs five seats",
        sub: "",
        before: { title: "One long chat with an AI", items: ["One steaming context pot — the longer, the messier", "No gatekeeper: shared code changes on a whim", "\"Done\" is whatever the AI claims it is"] },
        after: { title: "AI Matrix Team", items: ["Specialists own specialties; shared surfaces have a gatekeeper", "Machine gates stop every phase, with judgeable exit codes", "Handoff sheets on record — audit any time"] }
      },

      features: {
        eyebrow: "Features",
        title: "What it does",
        sub: "From a one-line idea to release and rollback, every stage has an owner and a gate.",
        items: [
          { icon: "branch", title: "Case building", desc: "New ideas pass the \"why is this worth it\" gate first: press-release drill, user stories, cost/benefit — no gut-feel kickoff." },
          { icon: "check", title: "Requirements & acceptance", desc: "Every requirement carries observable, testable acceptance criteria. No \"feels smooth\" hand-waving." },
          { icon: "terminal", title: "Code & quick calls", desc: "15-minute architecture quick-call before any code (TDD increment / ADR / breaking-change self-check). Build to the work order; ask before touching anything outside the whitelist." },
          { icon: "shield", title: "Independent QA", desc: "Whoever writes the code never waves it through: independent QA runs the full gate suite, checks AC line by line, and holds veto power." },
          { icon: "refresh", title: "Release & rollback", desc: "Deploy, migrate and roll back are owned jobs — a deployment without a rollback plan isn't a deployment, it's a gamble." },
          { icon: "layers", title: "Shared-surface gate", desc: "Code shared across products gets a dedicated gatekeeper: queue the work, approve before, register after." }
        ]
      },

      members: {
        eyebrow: "Crew",
        title: "Five seats, five gates",
        sub: "The creator, late at night in front of the screen, thinks of old friends scattered across big tech over a decade — and reunites them, at last, inside this virtual matrix."
      },

      install: {
        eyebrow: "Install",
        title: "Pick the install path for your agent",
        sub: "Regular agents (Codex / Claude Code) install it as a skill; WorkBuddy installs the whole expert team. Copy the prompt and paste it to the right agent."
      },

      showcase: {
        eyebrow: "Screens",
        title: "See the real thing",
        sub: "",
        items: []
      },

      steps: {
        eyebrow: "Get started",
        title: "Up and running in three steps",
        sub: "The agent runs the commands. You only say what you want and check the result.",
        items: [
          { title: "Let your agent install it", desc: "Paste the line into the chat — the agent clones the repo, reads the docs, and tells you how to use it.", codeKey: "install" },
          { title: "Say what you want", desc: "Just describe the outcome: onboard a new app, change a shared module, run a compliance sweep…", codeName: "prompt", code: "Onboard a new app — run the full pipeline from business case to release" },
          { title: "Check the handoff", desc: "Read the gate reports and handoff sheet: which phases passed, which decisions are still yours — all in one place.", codeName: "path", code: "http://127.0.0.1:4780 · the console" }
        ]
      },

      faq: {
        eyebrow: "FAQ",
        title: "Frequently asked",
        items: [
          { q: "How do I install it in WorkBuddy?", a: "Search 「AI Matrix Team」 in the WorkBuddy Expert Center and enable it; or paste the install prompt to WorkBuddy — it follows <code>SKILL.md</code> to onboard your project (profile + skill symlinks + expert packages) and runs a gate check." },
          { q: "How about Codex / Claude Code?", a: "They consume it as a skill: clone into the right directory (Codex: <code>~/.codex/skills/</code> or <code>.agents/skills/</code>; Claude Code: <code>~/.claude/skills/</code>) and the agent picks up <code>SKILL.md</code>. One-click prompts are in the Install section above." },
          { q: "Can I install it manually, without an agent?", a: "Yes — just <code>git clone</code>. Plain text plus Node scripts, no build step; the gate and inspection CLIs under <code>scripts/</code> run as-is." },
          { q: "Why exactly five?", a: "More agents burn tokens without moving the work; fewer breed confusion and hallucinations. Five seats cover it: gatekeeping, requirements & design, building, QA, release." },
          { q: "Is it free?", a: "Yes, open source under MIT. All gates and ledgers run locally — your data never leaves the machine." }
        ]
      },

      cta: { title: "Give your agent a disciplined delivery crew", desc: "Copy the install prompt, paste it to your AI — onboarded in seconds, you just make the calls.", primary: "Open on GitHub", secondary: "Copy install prompt" },
      footer: { license: "Free & open source", madeWith: "Built with iskill-promo-page" }
    }
  }
};
