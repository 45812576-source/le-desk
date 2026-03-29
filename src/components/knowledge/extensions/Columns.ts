import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    columnBlock: {
      setColumns: (cols?: number) => ReturnType;
    };
  }
}

export const Column = Node.create({
  name: "column",
  group: "column",
  content: "block+",

  parseHTML() {
    return [{ tag: "div[data-column]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-column": "", class: "column" }), 0];
  },
});

export const ColumnBlock = Node.create({
  name: "columnBlock",
  group: "block",
  content: "column{2,4}",
  defining: true,

  addAttributes() {
    return {
      columns: { default: 2 },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-column-block]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, {
        "data-column-block": "",
        "data-columns": String(node.attrs.columns),
        class: "column-block",
        style: `grid-template-columns: repeat(${node.attrs.columns}, 1fr)`,
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setColumns:
        (cols = 2) =>
        ({ commands }) => {
          const columns = Array.from({ length: cols }, () => ({
            type: "column",
            content: [{ type: "paragraph" }],
          }));
          return commands.insertContent({
            type: this.name,
            attrs: { columns: cols },
            content: columns,
          });
        },
    };
  },
});
