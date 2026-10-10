# 坑位表（aimatrix-guardian 参考）

本文件由 [`../SKILL.md`](../SKILL.md) 外移，按需读。

## 8. 本项目坑位

| 症状 | 根因 | 修法 |
|---|---|---|
| 改了规范文档没同步 Skill | ★ 文档与 Skill 两处真相 | `guard sync-check`（退出码 6）；核准时把「Skill 已同步」当勾选项 |
| 忘释放锁堵住全队 | 收口清单漏项 | TTL 240min 自动释放兜底；连续两次忘放 → 通报创始人 |
| `.workbuddy/skills/` 被手改 | 不懂软链是机器产物 | `install-to-workbuddy.mjs --check` 查漂移；手改 = 流程事故 |
