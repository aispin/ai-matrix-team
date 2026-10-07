import { XMarkdown } from '@ant-design/x-markdown';

/**
 * Markdown 渲染（v2 · WO-20261007-11）：@ant-design/x-markdown（创始人指定候选之一）。
 * 选型理由：Ant Design X 系（与设计师技能的 Agent Chat 设计语言对齐）、GFM 表格原生支持
 * （WO/DR 单据大量表格）、内置 DOMPurify 防 XSS、流式渲染可备将来打字机场景。
 * 旧迷你渲染器只覆盖 6 种语法、无表格，已全量替换（git 历史可回溯）；
 * 默认样式随主题色继承，表格/代码块补齐见 styles.css 的 .md 段。
 */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <XMarkdown content={text} openLinksInNewTab />
    </div>
  );
}
