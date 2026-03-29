import { Node, mergeAttributes } from "@tiptap/core";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    fileEmbed: {
      setFileEmbed: (attrs: { src: string; filename: string; fileType?: string }) => ReturnType;
    };
  }
}

export const FileEmbed = Node.create({
  name: "fileEmbed",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      filename: { default: "" },
      fileType: { default: "file" }, // video | audio | file
    };
  },

  parseHTML() {
    return [{ tag: "div[data-file-embed]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const { src, filename, fileType } = node.attrs;

    if (fileType === "video") {
      return [
        "div",
        mergeAttributes(HTMLAttributes, { "data-file-embed": "", class: "file-embed" }),
        ["video", { src, controls: "true", class: "file-embed-video" }],
      ];
    }

    if (fileType === "audio") {
      return [
        "div",
        mergeAttributes(HTMLAttributes, { "data-file-embed": "", class: "file-embed" }),
        ["audio", { src, controls: "true", class: "file-embed-audio" }],
      ];
    }

    // Generic file card
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-file-embed": "", class: "file-embed file-embed-card" }),
      ["a", { href: src, target: "_blank", rel: "noopener", class: "file-embed-link" }, filename || "下载文件"],
    ];
  },

  addCommands() {
    return {
      setFileEmbed:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    };
  },
});
