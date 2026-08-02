# Markdown与LaTeX聊天渲染

## 1. 渲染链

```text
模型/用户纯文本
→ react-markdown
→ remark-gfm
→ remark-math
→ rehype-katex
→ React元素
→ KaTeX HTML + MathML
```

支持CommonMark、GFM表格、任务列表、删除线、代码、链接以及TeX数学表达式。

## 2. 语法

行内公式：

```markdown
勾股定理为 $a^2+b^2=c^2$。
```

块级公式：

```markdown
$$
P(A|B)=\frac{P(B|A)P(A)}{P(B)}
$$
```

代码块：

````markdown
```ts
const state: 'queued' | 'running' = 'queued';
```
````

## 3. 安全边界

- `skipHtml`开启，不渲染消息中的原始HTML；
- 不安装或启用`rehype-raw`；
- KaTeX设置`trust:false`；
- 使用严格解析并在错误时显示可读文本，而不是执行不可信命令；
- URL先经过`react-markdown`默认转换；
- 外部链接使用`noopener noreferrer`；
- Electron Main进程拒绝应用内任意新窗口，仅允许安全HTTPS链接交给系统浏览器；
- Markdown组件无法访问Node、SQLite、SecretStore或原始IPC。

## 4. 可访问性与可复制性

- KaTeX同时输出视觉HTML和MathML；
- 表格放入横向滚动容器；
- 代码块显示语言并提供复制按钮；
- 复选框只读，避免消息内容成为隐式写操作；
- 深色代码块与白色正文保持足够层次。

## 5. 当前边界

- 尚未加入Mermaid、交互图形和数学编辑器；
- 不允许消息中嵌入任意iframe、script、style或HTML组件；
- 复制使用系统Clipboard API，失败时不影响消息阅读；
- 复杂TeX宏以KaTeX支持范围为准。
